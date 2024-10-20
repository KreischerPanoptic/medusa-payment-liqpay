import {
    type MedusaRequest,
    MedusaResponse,
    EventBusService,
} from "@medusajs/medusa";
import crypto from "crypto";

import LiqPayPaymentProcessor, {
    type LiqPayPaymentProcessorConfig,
} from "../../../services/liqpay-payment-processor";

import {
    SUPPORTED_EVENTS,
    WebhookEventData,
} from "../../../subscribers/webhooks";
import LiqPay from "../../../lib/liqpay";
import {sign} from "node:crypto";
import {LiqPayCallbackStatusResponse} from "../../../lib/interfaces/liqpay.interfaces";

type WebhookEvent = {
    data: string;
    signature: string;
};

export const POST = async (
    req: MedusaRequest<WebhookEvent>,
    res: MedusaResponse,
) => {
    try {
        const pluginConfiguration = req.scope.resolve<
            LiqPayPaymentProcessor & {
            configuration: LiqPayPaymentProcessorConfig;
        }
        >(`pp_${LiqPayPaymentProcessor.identifier}`).configuration;
        const publicKey = pluginConfiguration.public_key;
        const privateKey = pluginConfiguration.private_key;

        if (!publicKey) {
            console.error("LP_P_Debug: No public key provided for LiqPay plugin");
            return res.sendStatus(500);
        }

        if (!privateKey) {
            console.error("LP_P_Debug: No private key provided for LiqPay plugin");
            return res.sendStatus(500);
        }
        const liqPay = new LiqPay(publicKey, privateKey);
        // Validate webhook event
        const signature = liqPay.sign(privateKey+req.body.data+privateKey);

        if (signature !== req.body.signature) {
            return res.status(400).send("Invalid signature");
        }
        const jsonString = Buffer.from(req.body.data, 'base64').toString();
        const obj = JSON.parse(jsonString) as LiqPayCallbackStatusResponse;
        if(obj.status !== 'success' && obj.status !== 'subscribed') {
            return res.sendStatus(200);
        }
//TODO: Change event, send syntetic event

        if (pluginConfiguration.debug) {
            console.info(
                `LP_P_Debug: Received LiqPay webhook event: ${obj.status} with data:`,
                JSON.stringify(obj, null, 2),
            );
        }

        const eventData = {
            event: obj.status,
            data: obj,
        } satisfies WebhookEventData;

        const eventBus = req.scope.resolve<EventBusService>("eventBusService");

        await eventBus.emit("liqpay.webhook_event", eventData, {
            // Delayed to prevent race conditions with manual order confirmation
            delay: 5000,
        });

        return res.sendStatus(200);
    } catch (err) {
        console.error("LP_P_Debug: Error handling LiqPay webhook event", err);
        return res.sendStatus(500);
    }
};