export class DxDate {
    private date: Date;
    private year: string;
    private month: string;
    private day: string;
    private hours: string;
    private minutes: string;
    private seconds: string;
    private week: string;

    constructor(input: string | number | Date) {
        this.date = new Date(input);
        this.year = String(this.date.getFullYear());
        this.month = String(this.date.getMonth() + 1).padStart(2, '0');
        this.day = String(this.date.getDate()).padStart(2, '0');
        this.hours = String(this.date.getHours()).padStart(2, '0');
        this.minutes = String(this.date.getMinutes()).padStart(2, '0');
        this.seconds = String(this.date.getSeconds()).padStart(2, '0');
        this.week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][this.date.getDay()];
    }

    // 格式化输出
    format(pattern: string): string {
        const formatMap: Record<string, string> = {
            "ss": this.seconds,
            "mm:ss": `${this.minutes}:${this.seconds}`,
            "HH:mm": `${this.hours}:${this.minutes}`,
            "HH:mm:ss": `${this.hours}:${this.minutes}:${this.seconds}`,
            "DD HH:mm:ss": `${this.day} ${this.hours}:${this.minutes}:${this.seconds}`,
            "MM-DD HH:mm:ss": `${this.month}-${this.day} ${this.hours}:${this.minutes}:${this.seconds}`,
            "YYYY-MM-DD HH:mm:ss": `${this.year}-${this.month}-${this.day} ${this.hours}:${this.minutes}:${this.seconds}`,
            "YYYY-MM-DD HH:mm": `${this.year}-${this.month}-${this.day} ${this.hours}:${this.minutes}`,
            "MM-DD HH:mm": `${this.month}-${this.day} ${this.hours}:${this.minutes}`,
            "YYYY-MM-DD HH": `${this.year}-${this.month}-${this.day} ${this.hours}`,
            "YYYY-MM-DD": `${this.year}-${this.month}-${this.day}`,
            "YYYY年MM月DD日": `${this.year}年${this.month}月${this.day}日`
        };

        return formatMap[pattern] || formatMap["YYYY-MM-DD HH:mm:ss"];
    }

    // 判断是否是今天、本月、本年
    is_same(unit: 'day' | 'month' | 'year'): boolean {
        const now = new Date();

        const sameYear = this.date.getFullYear() === now.getFullYear();
        if (unit === 'year') return sameYear;

        const sameMonth = this.date.getMonth() === now.getMonth();
        if (unit === 'month') return sameYear && sameMonth;

        const sameDay = this.date.getDate() === now.getDate();
        return sameYear && sameMonth && sameDay;
    }

    // 与当前时间相差的毫秒数（可正可负）
    differ(): number {
        return this.date.getTime() - Date.now();
    }

    // 评论时间显示逻辑
    commnet_time(): string {
        if (this.is_same("day")) {
            return this.format("HH:mm");
        } else if (this.is_same("year")) {
            return this.format("MM-DD HH:mm");
        } else {
            return this.format("YYYY-MM-DD HH:mm");
        }
    }
}