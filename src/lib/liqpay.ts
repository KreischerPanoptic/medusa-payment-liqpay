import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";
import * as crypto from 'crypto'
import {
    LiqPayInfoStatusRequest,
    LiqPayRefundRequest,
    LiqPayResponse,
    LiqPayStatusResponse
} from "./interfaces/liqpay.interfaces";

export const LIQPAY_API_PATH = "https://www.liqpay.ua/api";

type HTTPMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "OPTIONS"
    | "HEAD";

interface Request {
    path: string;
    method: HTTPMethod;
    headers?: Record<string, string>;
    data?: URLSearchParams;
    query?: Record<string, string>;
}

export interface LiqPayWrapperOptions {
    disable_retries?: boolean;
}

export default class LiqPay {
    privateKey: string;
    publicKey: string;

    protected readonly axiosInstance: AxiosInstance;

    constructor(publicKey: string, privateKey: string, options?: LiqPayWrapperOptions) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;

        this.axiosInstance = axios.create({
            baseURL: LIQPAY_API_PATH,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
        });

        if (options?.disable_retries !== true) {
            axiosRetry(this.axiosInstance, {
                retries: 3,
                // Enables retries on network errors, idempotent http methods, and 5xx errors
                retryCondition: axiosRetry.isNetworkOrIdempotentRequestError,
                // Exponential backoff with jitter
                retryDelay: axiosRetry.exponentialDelay,
            });
        }
    }

    protected async requestLiqPayAPI<T>(request: Request): Promise<T> {
        const options = {
            method: request.method,
            url: request.path,
            params: request.query,
            data: request.data,
        } satisfies AxiosRequestConfig;

        try {
            const res = await this.axiosInstance(options);
            return res.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(
                    `Error from LiqPay API with status code ${error.response?.status}: ${error.response?.data?.err_description}`,
                );
            }

            throw error;
        }
    }

    transaction = {
        get: ({ id }: { id: string }) =>
            this.requestLiqPayAPI<LiqPayStatusResponse>({
                path: "/request",
                method: "POST",
                data: this.constructObject({
                    action   : "status",
                    version  : 3,
                    order_id : id,
                    public_key: this.publicKey
                })
            }),
    }

    refund = {
        create: ({ id, amount }: { id: string, amount: number }) =>
            this.requestLiqPayAPI<LiqPayResponse>({
                path: "/request",
                method: "POST",
                data: this.constructObject({
                    action: "refund",
                    amount: amount,
                    version  : 3,
                    order_id : id,
                    public_key: this.publicKey
                }),
            }),
    };


    private constructSignature(params: LiqPayInfoStatusRequest | LiqPayRefundRequest): string {
        const data = this.constructData(params);
        return this.sign(this.privateKey + data + this.privateKey);
    }

    private constructObject(params: LiqPayInfoStatusRequest | LiqPayRefundRequest) : URLSearchParams {
        const data = new URLSearchParams();
        data.append('data', this.constructData(params))
        data.append('signature', this.constructSignature(params));

        return data;
    }

    public sign(str: string) : string {
        const sha1 = crypto.createHash('sha1');
        sha1.update(str);
        return sha1.digest('base64');
    }

    private constructData(params: LiqPayInfoStatusRequest | LiqPayRefundRequest): string {
        return Buffer.from(JSON.stringify(params)).toString('base64')
    }
}