export class Tick {
    symbol;
    stockData;
    datetime;
    high;
    low;
    open;
    depth: {
        buy: [{ quantity: number, price: number, orders: number }],
        sell: [{ quantity: number, price: number, orders: number }]
    };
    close;
    volume;
    oi;
    last_price;

    constructor(body: any) {
        this.symbol = body.symbol || body.tradingsymbol;
        this.datetime = body.datetime || new Date(body.exchange_timestamp);
        this.high = parseFloat(body.high || body.ohlc.high);
        this.low = parseFloat(body.low || body.ohlc.low);
        this.open = parseFloat(body.open || body.ohlc.open);
        this.close = parseFloat(body.close || body.ohlc.close);
        this.volume = parseFloat(body.volume || body.volume_traded);
        this.depth = body.depth
        this.oi = parseFloat(body.oi);
        this.last_price = parseFloat(body.last_price || body.close || body.ohlc.close);
        this.stockData = body.stockData;
    }

    summary() {
        let copy: any = {};
        Object.assign(copy, this)
        copy.symbol = this.stockData.tradingsymbol;
        delete copy.stockData
        return copy;
    }

    toString() {
        return `${new Date(this.datetime).getHours()}:${new Date(this.datetime).getMinutes()}:${new Date(this.datetime).getSeconds()} ${this.symbol} ${this.close} (${this.open > this.close ? '-' : '+'}${Math.round(Math.abs(this.close - this.open) * 100) / 100})`
    }
}
