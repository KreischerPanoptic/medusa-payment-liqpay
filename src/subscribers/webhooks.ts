import type {
    AbstractCartCompletionStrategy,
    CartService,
    IdempotencyKeyService,
    MedusaContainer,
    SubscriberArgs,
    SubscriberConfig,
} from "@medusajs/medusa";
import type { EntityManager } from "typeorm";
import { MedusaError } from "@medusajs/utils";
import LiqPayPaymentProcessor, {
    type LiqPayPaymentProcessorConfig,
} from "../services/liqpay-payment-processor";
import {LiqPayCallbackStatusResponse} from "../lib/interfaces/liqpay.interfaces";

export const SUPPORTED_EVENTS = ["charge.success"];

export type WebhookEventData = {
    event: (typeof SUPPORTED_EVENTS)[number];
    data: LiqPayCallbackStatusResponse;
};

export const config: SubscriberConfig = {
    event: "liqpay.webhook_event",
};

export default async function webhookHandle({
                                                data,
                                                container,
                                            }: SubscriberArgs<WebhookEventData>) {
    const pluginConfiguration = container.resolve<
        LiqPayPaymentProcessor & {
        configuration: LiqPayPaymentProcessorConfig;
    }
    >(`pp_${LiqPayPaymentProcessor.identifier}`).configuration;

    const cartId = data.data.order_id;

    if (!cartId) {
        console.error(
            "LP_P_Debug: No cart_id found in webhook transaction metadata",
        );
        return;
    }

    switch (data.event) {
        case "success": {
            await handleChargeSuccess(container, cartId);
            break;
        }
        default:
            break;
    }

    if (pluginConfiguration.debug) {
        console.info(
            `LP_P_Debug: Handled LiqPay webhook event: ${data.event} successfully`,
        );
    }
}

async function handleChargeSuccess(container: MedusaContainer, cartId: string) {
    const orderService = container.resolve("orderService");
    const order = await orderService
        .retrieveByCartId(cartId)
        .catch(() => undefined);

    if (order) {
        // Order already placed, do nothing
        return;
    }

    const completionStrategy: AbstractCartCompletionStrategy = container.resolve(
        "cartCompletionStrategy",
    );
    const cartService = container.resolve<CartService>("cartService");
    const idempotencyKeyService = container.resolve<IdempotencyKeyService>(
        "idempotencyKeyService",
    );
    const manager = container.resolve<EntityManager>("manager");

    await manager.transaction(async transactionManager => {
        const idempotencyKeyServiceTx =
            idempotencyKeyService.withTransaction(transactionManager);
        let idempotencyKey = await idempotencyKeyServiceTx
            .retrieve({
                request_path: "/liqpay/webhook",
                idempotency_key: cartId,
            })
            .catch(() => undefined);

        if (!idempotencyKey) {
            idempotencyKey = await idempotencyKeyService
                .withTransaction(transactionManager)
                .create({
                    request_path: "/liqpay/webhook",
                    idempotency_key: cartId,
                });
        }

        const cart = await cartService
            .withTransaction(transactionManager)
            .retrieve(cartId, { select: ["context"] });

        const { response_code, response_body } = await completionStrategy
            .withTransaction(transactionManager)
            .complete(cartId, idempotencyKey, { ip: cart.context?.ip as string });

        if (response_code !== 200) {
            console.error(
                `LP_P_Debug: Error completing cart from webhook event with id ${cartId}`,
                JSON.stringify(response_body, null, 2),
            );

            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                response_body["message"] as string,
                response_body["code"] as string,
            );
        }
    });
}