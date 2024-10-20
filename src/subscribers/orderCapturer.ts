import type {
    OrderService,
    SubscriberConfig,
    SubscriberArgs,
} from "@medusajs/medusa";
import LiqPayPaymentProcessor, {
    type LiqPayPaymentProcessorConfig,
} from "../services/liqpay-payment-processor";

type OrderPlacedData = {
    id: string;
};

function isOrderPlacedData(data: unknown): data is OrderPlacedData {
    return typeof data === "object" && data !== null && "id" in data;
}

export const config: SubscriberConfig = {
    event: "order.placed",
};

export default async function orderCapturer({
                                                container,
                                                data,
                                            }: SubscriberArgs) {
    const orderService = container.resolve<OrderService>("orderService");
    const pluginConfiguration = container.resolve<
        LiqPayPaymentProcessor & {
        configuration: LiqPayPaymentProcessorConfig;
    }
    >(`pp_${LiqPayPaymentProcessor.identifier}`).configuration;

    try {
        if (!isOrderPlacedData(data)) {
            return;
        }

        const order = await orderService.retrieve(data.id, {
            relations: ["payments"],
        });
        if (!order) return;

        // Check if the order was paid for with Paystack
        const isPaidForWithLiqPay = order.payments?.some(
            p => p.provider_id === "liqpay",
        );
        if (!isPaidForWithLiqPay) return;

        if (pluginConfiguration.debug) {
            console.info(
                "LP_P_Debug: Capturing LiqPay order with data:",
                JSON.stringify(data, null, 2),
            );
        }

        // Capture the payment
        await orderService.capturePayment(order.id);
    } catch (error) {
        console.error("Error capturing LiqPay order:", error);
    }
}