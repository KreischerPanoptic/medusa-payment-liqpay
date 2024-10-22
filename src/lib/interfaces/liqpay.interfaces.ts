export enum LiqPayInfoRequestActionEnum {
    data = 'data',
    status = 'status',
    refund = 'refund',
    ticket = 'ticket',
    reports = 'reports',
    reports_compensation = 'reports_compensation',
    register = 'register',
    reports_compensation_file = 'reports_compensation_file',
}

export type LiqPayInfoRequestActionUnion = `${LiqPayInfoRequestActionEnum}`;

export enum LiqPayActionsEnum {
    pay = 'pay',
    hold = 'hold',
    subscribe = 'subscribe',
    paydonate = 'paydonate',
    auth = 'auth',
    paysplit = 'paysplit',
    regular = 'regular'
}

export type LiqPayActionUnion = `${LiqPayActionsEnum}`;

export enum LiqPayBonusTypeEnum {
    bonusplus = 'bonusplus',
    discount_club = 'discount_club',
    personal = 'personal',
    promo = 'promo'
}

export type LiqPayBonusTypeUnion = `${LiqPayBonusTypeEnum}`;

export enum LiqPayPayTypeEnum {
    card = 'card',
    privat24 = 'privat24',
    masterpass = 'masterpass',
    moment_part = 'moment_part',
    cash = 'cash',
    invoice = 'invoice',
    qr = 'qr'
}

export type LiqPayPayTypeUnion = `${LiqPayPayTypeEnum}`;

export enum LiqPayStatusEnum {
    error = 'error',
    failure = 'failure',
    reversed = 'reversed',
    subscribed = 'subscribed',
    success = 'success',
    unsubscribed = 'unsubscribed',
    is_3ds_verify = '3ds_verify',
    captcha_verify = 'captcha_verify',
    cvv_verify = 'cvv_verify',
    ivr_verify = 'ivr_verify',
    otp_verify = 'otp_verify',
    password_verify = 'password_verify',
    phone_verify = 'phone_verify',
    pin_verify = 'pin_verify',
    receiver_verify = 'receiver_verify',
    sender_verify = 'sender_verify',
    senderapp_verify = 'senderapp_verify',
    wait_qr = 'wait_qr',
    p24_verify = 'p24_verify',
    mp_verify = 'mp_verify',
    cash_wait = 'cash_wait',
    hold_wait = 'hold_wait',
    invoice_wait = 'invoice_wait',
    prepared = 'prepared',
    processing = 'processing',
    wait_accept = 'wait_accept',
    wait_card = 'wait_card',
    wait_compensation = 'wait_compensation',
    wait_lc = 'wait_lc',
    wait_reserve = 'wait_reserve',
    wait_secure = 'wait_secure',
    try_again = 'try_again'
}

export type LiqPayStatusUnion = `${LiqPayStatusEnum}`;

export class LiqPayInfoStatusRequest {
    version: number = 3;
    public_key: string = '';
    action: LiqPayInfoRequestActionUnion = LiqPayInfoRequestActionEnum.status;
    order_id: string = '';
}

export class LiqPayRefundRequest extends LiqPayInfoStatusRequest {
    amount: number = 0.0;
}

export interface LiqPayResponse {
    action?: LiqPayActionUnion;
    payment_id?: number;
    status?: LiqPayStatusUnion;
}

export interface LiqPayStatusResponse extends LiqPayResponse {
    acq_id?: number;
    agent_commission?: number;
    amount?: number;
    amount_bonus?: number;
    amount_credit?: number;
    amount_debit?: number;
    authcode_credit?: string;
    authcode_debit?: string;
    bonus_procent?: number;
    bonus_type?: LiqPayBonusTypeUnion;
    card_token?: string;
    commission_credit?: number;
    commission_debit?: number;
    create_date?: string | number;
    currency?: string;
    currency_credit?: string;
    currency_debit?: string;
    description?: string;
    end_date?: string | number;
    info?: string;
    ip?: string;
    is_3ds?: boolean;
    liqpay_order_id?: string;
    moment_part?: string | boolean;
    mpi_eci?: 5 | '5' | 6 | '6' | 7 | '7';
    order_id?: string;
    paytype?: LiqPayPayTypeUnion;
    public_key?: string;
    receiver_commission?: number;
    rrn_credit?: string;
    rrn_debit?: string;
    sender_bonus?: number;
    sender_card_bank?: string;
    sender_card_country?: string | number;
    sender_card_mask2?: string;
    sender_card_type?: string;
    sender_commission?: number;
    sender_phone?: string;
    wait_reserve_status?: string | 'true' | true,
    transaction_id?: number;
    type?: string;
    version?: number;
    err_code?: string;
    err_description?: string;
}

export interface LiqPayCallbackStatusResponse extends LiqPayStatusResponse {
    redirect_to?: string;
    refund_date_last?: string | number;
    sender_first_name?: string;
    sender_last_name?: string;
    token?: string;
    err_erc?: string;
    product_category?: string;
    product_description?: string;
    product_name?: string;
    product_url?: string;
    refund_amount?: number;
    verifycode?: string;
}