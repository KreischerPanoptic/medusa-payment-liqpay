import LiqPay from "../lib/liqpay";

import {
    AbstractPaymentProcessor,
    CartService,
    MedusaContainer,
    PaymentProcessorContext,
    PaymentProcessorError,
    PaymentProcessorSessionResponse,
    PaymentSessionStatus, Region,
} from "@medusajs/medusa";
import {MedusaError, MedusaErrorTypes} from "@medusajs/utils";
import {LiqPayStatusEnum, LiqPayStatusUnion} from "../lib/interfaces/liqpay.interfaces";

export interface LiqPayPaymentProcessorConfig
    extends Record<string, unknown> {
    /**
     * LiqPay Public Key
     *
     * Should be in the format sandbox_... or ...
     */
    public_key: string;

    /**
     * LiqPay Private Key
     *
     * Should be in the format sandbox_... or ...
     */
    private_key: string;

    /**
     * Disable retries on network errors and 5xx errors on idempotent requests to Paystack
     *
     * Generally, you should not disable retries, these errors are usually temporary
     * but it can be useful for debugging
     * @default false
     */
    disable_retries?: boolean;

    /**
     * Debug mode
     * If true, logs helpful debug information to the console
     * Logs are prefixed with "PS_P_Debug"
     */
    debug?: boolean;
}

type RegionInfo = Pick<Region, "currency_code" | "tax_code" | "tax_rate">
const noDivisionCurrencies = [
    "krw",
    "jpy",
    "vnd",
    "clp",
    "pyg",
    "xaf",
    "xof",
    "bif",
    "djf",
    "gnf",
    "kmf",
    "mga",
    "rwf",
    "xpf",
    "htg",
    "vuv",
    "xag",
    "xdr",
    "xau",
]

class LiqPayPaymentProcessor extends AbstractPaymentProcessor {
    static identifier = "liqpay";

    protected readonly cartService: CartService;
    protected readonly configuration: LiqPayPaymentProcessorConfig;
    protected readonly liqpay: LiqPay;
    protected readonly debug: boolean;

    constructor(
        container: Record<string, any> & MedusaContainer,
        options: LiqPayPaymentProcessorConfig,
    ) {
        super(container, options);

        if (!options.public_key) {
            throw new MedusaError(
                MedusaError.Types.INVALID_ARGUMENT,
                "The LiqPay provider requires the public_key option",
            );
        }

        if (!options.private_key) {
            throw new MedusaError(
                MedusaError.Types.INVALID_ARGUMENT,
                "The LiqPay provider requires the private_key option",
            );
        }

        this.configuration = options;
        this.liqpay = new LiqPay(this.configuration.public_key, this.configuration.private_key, {
            disable_retries: options.disable_retries,
        });
        this.debug = Boolean(options.debug);

        // Container is just an object - https://docs.medusajs.com/development/fundamentals/dependency-injection#in-classes
        this.cartService = container.cartService;

        if (this.cartService.retrieveWithTotals === undefined) {
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                "Your Medusa installation contains an outdated cartService implementation. Update your Medusa installation.",
            );
        }
    }

    private convertToDecimal(amount: number, region: RegionInfo) {
        const divisor = noDivisionCurrencies.includes(
            region?.currency_code?.toLowerCase()
        )
            ? 1
            : 100

        return Math.floor(amount) / divisor
    }

    async authorizePayment(paymentSessionData: Record<string, unknown> & {
        orderId: string;
        cartId: string;
    }, context: Record<string, unknown>): Promise<PaymentProcessorError | {
        status: PaymentSessionStatus;
        data: PaymentProcessorSessionResponse["session_data"]
    }> {
        if (this.debug) {
            console.info(
                "LP_P_Debug: AuthorizePayment",
                JSON.stringify(paymentSessionData, null, 2),
            );
        }

        try {
            const { orderId, cartId } = paymentSessionData;
            const data = await this.liqpay.transaction.get({
                id: cartId,
            });
            const cart = await this.cartService.retrieveWithTotals(cartId);

            if (this.debug) {
                console.info(
                    "LP_P_Debug: AuthorizePayment: Verification",
                    JSON.stringify({ liqpay: data, status: data.status, cart }, null, 2),
                );
            }

            if (data.status === LiqPayStatusEnum.error ||
                data.status === LiqPayStatusEnum.failure ||
                data.status === LiqPayStatusEnum.try_again || data.err_code) {
                return {
                    status: PaymentSessionStatus.ERROR,
                    data: {
                        ...paymentSessionData,
                        orderId: orderId,
                        cartId: cart.id,
                        liqpayData: data
                    },
                };
            }
            if(data.status) {
                switch (data.status as LiqPayStatusUnion) {
                    case 'success':
                    case 'subscribed': {
                        const amountValid =
                            this.convertToDecimal(cart.total, cart.region) === data.amount;
                        const currencyValid =
                            cart.region.currency_code.toLowerCase() === data.currency.toLowerCase();
                        if (this.debug) {
                            console.info(
                                "LP_P_Debug: AuthorizePayment: Verification of Amount and Currency",
                                JSON.stringify({ currencyValid, amountValid, liqPayAmount: data.amount, cartAmount: this.convertToDecimal(cart.total, cart.region), liqPayCurrency: data.currency, cartCurrency: cart.region.currency_code }, null, 2),
                            );
                        }
                        if (amountValid && currencyValid) {
                            // Successful transaction
                            return {
                                status: PaymentSessionStatus.AUTHORIZED,
                                data: {
                                    orderId: orderId,
                                    cartId: cartId,
                                    liqpayData: data
                                },
                            };
                        }

                        // Invalid amount or currency
                        // We refund the transaction
                        await this.refundPayment(
                            {
                                ...paymentSessionData,
                                orderId: orderId,
                                cartId: cartId,
                                liqpayData: data
                            },
                            data.amount,
                        );

                        // And return the failed status
                        return {
                            status: PaymentSessionStatus.ERROR,
                            data: {
                                ...paymentSessionData,
                                orderId: orderId,
                                cartId: cartId,
                                liqpayData: data
                            },
                        };
                    }
                    case 'error':
                    case 'failure':
                    case 'try_again':
                        return {
                            status: PaymentSessionStatus.ERROR,
                            data: {
                                ...paymentSessionData,
                                orderId: orderId,
                                cartId: cartId,
                                liqpayData: data
                            },
                        };
                    default:
                        return {
                            status: PaymentSessionStatus.PENDING,
                            data: paymentSessionData,
                        };
                }
            }
            else {
                return {
                    status: PaymentSessionStatus.PENDING,
                    data: paymentSessionData,
                };
            }
        } catch (error) {
            return this.buildError("Failed to authorize payment", error);
        }
    }

    async cancelPayment(paymentSessionData: Record<string, unknown>): Promise<Record<string, unknown> | PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]> {
        return paymentSessionData;
    }

    async capturePayment(paymentSessionData: Record<string, unknown>): Promise<Record<string, unknown> | PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]> {
        return paymentSessionData;
    }

    async deletePayment(paymentSessionData: Record<string, unknown>): Promise<Record<string, unknown> | PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]> {
        return paymentSessionData;
    }

    async getPaymentStatus(paymentSessionData: Record<string, unknown> & { cartId?: string }): Promise<PaymentSessionStatus> {
        if (this.debug) {
            console.info(
                "LP_P_Debug: GetPaymentStatus",
                JSON.stringify(paymentSessionData, null, 2),
            );
        }

        const { cartId } = paymentSessionData;

        if (!cartId) {
            return PaymentSessionStatus.PENDING;
        }
        try {
            const {status} = await this.liqpay.transaction.get({
                id: cartId,
            });
            switch (status) {
                case LiqPayStatusEnum.success:
                case LiqPayStatusEnum.subscribed:
                    return PaymentSessionStatus.AUTHORIZED;
                case LiqPayStatusEnum.unsubscribed:
                case LiqPayStatusEnum.reversed:
                    return PaymentSessionStatus.CANCELED;
                case LiqPayStatusEnum.error:
                case LiqPayStatusEnum.failure:
                case LiqPayStatusEnum.try_again:
                    return PaymentSessionStatus.ERROR;
                default:
                    return PaymentSessionStatus.PENDING;
            }
        }
        catch (error) {
            return PaymentSessionStatus.ERROR;
        }
    }

    async initiatePayment(context: PaymentProcessorContext): Promise<PaymentProcessorError | (PaymentProcessorSessionResponse & {
        session_data: {
            cartId: string;
        };
    })> {
        if (this.debug) {
            console.info(
                "LP_P_Debug: InitiatePayment",
                JSON.stringify(context, null, 2),
            );
        }

        return {
            session_data: {
                cartId: context.resource_id,
            },
        };
    }

    async refundPayment(paymentSessionData: Record<string, unknown> & { cartId?: string }, refundAmount: number): Promise<PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]> {
        if (this.debug) {
            console.info(
                "LP_P_Debug: RefundPayment",
                JSON.stringify({ paymentSessionData, refundAmount }, null, 2),
            );
        }

        try {
            const { cartId } = paymentSessionData;

            const cart = await this.cartService.retrieveWithTotals(cartId);
            const translatedAmount = this.convertToDecimal(refundAmount, cart.region)
            if (this.debug) {
                console.info(
                    "LP_P_Debug: RefundPayment",
                    JSON.stringify({ paymentSessionData, cart, translatedAmount }, null, 2),
                );
            }
            const data = await this.liqpay.refund.create({
                id: cartId,
                amount: translatedAmount,
            });
            const { status } = data;

            if (status !== LiqPayStatusEnum.reversed) {
                return this.buildError("Failed to refund payment", {
                    detail: '',
                });
            }

            return {
                ...paymentSessionData,
                liqpayData: data,
            };
        } catch (error) {
            return this.buildError("Failed to refund payment", error);
        }
    }

    async retrievePayment(paymentSessionData: Record<string, unknown> & { cartId?: string }): Promise<PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]> {
        if (this.debug) {
            console.info(
                "LP_P_Debug: RetrievePayment",
                JSON.stringify(paymentSessionData, null, 2),
            );
        }

        try {
            const { cartId } = paymentSessionData;

            const data = await this.liqpay.transaction.get({
                id: cartId,
            });

            if (data.status === LiqPayStatusEnum.error) {
                return this.buildError("Failed to retrieve payment", {detail: ''});
            }

            return {
                ...paymentSessionData,
                liqpayTxData: data,
            };
        }
        catch (error) {
            return this.buildError("Failed to retrieve payment", error);
        }
    }

    async updatePayment(context: PaymentProcessorContext): Promise<PaymentProcessorError | (PaymentProcessorSessionResponse & {
        session_data: {
            cartId: string;
        };
    }) | void> {
        return this.initiatePayment(context);
    }

    async updatePaymentData(sessionId: string, data: Record<string, unknown>): Promise<PaymentProcessorSessionResponse["session_data"] | PaymentProcessorError> {
        if (this.debug) {
            console.info(
                "LP_P_Debug: UpdatePaymentData",
                JSON.stringify({ sessionId, data }, null, 2),
            );
        }

        if (data.amount) {
            throw new MedusaError(
                MedusaErrorTypes.INVALID_DATA,
                "Cannot update amount from updatePaymentData",
            );
        }

        return {
            session_data: {
                ...data, // We just return the data as is
            },
        };
    }

    protected buildError(
        message: string,
        e:
            | {
            code?: string;
            detail: string;
        }
            | Error,
    ): PaymentProcessorError {
        const errorMessage = "LiqPay Payment error: " + message;
        const code = e instanceof Error ? e.message : e.code;
        const detail = e instanceof Error ? e.stack : e.detail;

        return {
            error: errorMessage,
            code: code ?? "",
            detail: detail ?? "",
        };
    }
}

export default LiqPayPaymentProcessor;