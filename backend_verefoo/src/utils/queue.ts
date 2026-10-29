export class Queue<T> {
    private items: T[] = [];
    private head = 0;

    enqueue(item: T) {
        this.items.push(item);
    }

    dequeue(): T | undefined {
        if (this.head >= this.items.length) return undefined;
        return this.items[this.head++];
    }

    isEmpty() {
        return this.head >= this.items.length;
    }

    size() {
        return this.items.length - this.head;
    }
}