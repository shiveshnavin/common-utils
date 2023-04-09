export class Tick {
    symbol;
    stockData;
    datetime;
    high;
    low;
    open;
    close;
    volume;
    oi;
    last_price;

    constructor(body: any) {
        this.symbol = body.symbol;
        this.datetime = body.datetime;
        this.high = parseFloat(body.high);
        this.low = parseFloat(body.low);
        this.open = parseFloat(body.open);
        this.close = parseFloat(body.close);
        this.volume = parseFloat(body.volume);
        this.oi = parseFloat(body.oi);
        this.last_price = parseFloat(body.last_price || body.close)
        this.stockData = body.stockData;
    }

    summary() {
        let copy: any = {};
        Object.assign(copy, this)
        copy.symbol = this.stockData.tradingsymbol;
        delete copy.stockData
        return copy;
    }
}
