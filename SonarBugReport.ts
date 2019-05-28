class SonarBugReport {

    constructor(
        public rootNode: Element = document.body,
        public offset: number = 0,
        protected treeWalker: TreeWalker = document.createTreeWalker(rootNode)
    ) {
    }

    isBR(node: Node): boolean {
        return node.nodeName === 'BR';
    }

    get previousNode(): Node | null {
        const { treeWalker } = this;
        const old = treeWalker.currentNode;
        const previousNode = treeWalker.previousNode();
        if (old !== treeWalker.currentNode) {
            treeWalker.nextNode();
        }
        return previousNode;
    }

    get previousSibling(): Node | null {
        const { treeWalker } = this;
        const old = treeWalker.currentNode;
        const previousSibling = treeWalker.previousSibling();
        if (old !== treeWalker.currentNode) {
            treeWalker.nextSibling();
        }
        return previousSibling;
    }

    isNL(): boolean {
        const { treeWalker } = this;
        const node = treeWalker.currentNode;

        const selfIsBlock = isBlock(node);
        if (selfIsBlock) {
            let cur: Node | null = node;
            while (cur && cur !== this.rootNode) {
                const parent: Node | null = cur.parentNode;
                if (!parent || parent.firstChild !== cur) break;
                if (isBlock(parent)) return false;
                cur = parent;
            }

            return true;
        }
        else {
            const previousNode = this.previousNode;
            const previousSibling = this.previousSibling;

            if (previousSibling) {
                let cur: Node | null = previousNode;
                while (cur) {
                    if (cur.textContent !== '' && isBlock(cur)) {
                        return true;
                    }

                    if (cur === previousSibling) break;
                    cur = cur.parentNode;
                }
            }
        }

        return false;
    }

    falsePositive(flag: boolean = false): number {
        const { treeWalker } = this;
        let node: Node | null = treeWalker.currentNode;

        for (;;) {
            const { offset } = this;
            const text = node as Text; // note: only use where node.nodeType === TEXT_NODE!

            if (node.nodeType === 3 && offset < text.length) {
                const [codepoint, delta] = getNext(text.data, offset);
                if (codepoint !== -1) {
                    this.offset += delta;
                    return codepoint;
                }
            }
            else if (!offset && this.isBR(node!)) {
                this.offset = 1; // step past this linebreak
                return 10;
            }

            node = treeWalker.nextNode();

            if (node === null) {
                return -1;
            }

            this.offset = 0;

            if (this.isNL()) {
                return flag ? -10 : 10;
            }
        }
    }
}

function getNext(str: string, index: number, offset: number = 0): [number, number] {
    const pos = index + offset;
    if (pos >= str.length) {
        return [-1, offset];
    }
    const cp = str.codePointAt(pos)!;
    offset += 1;

    const secondHalf = cp >= 0xDC00 && cp <= 0xDFFF;
    if (secondHalf) {
        return getNext(str, index, offset);
    }

    return [cp, offset + Number(cp > 0xFFFF)];
}

const NL: { [key: string]: boolean } = {
    block: true
};

export function isBlock(elm: Node): boolean {
    if (elm.nodeType === 3) return false;

    return NL[
        ((elm as any).currentStyle || window.getComputedStyle(elm as Element, ''))
        .display
    ] === true;
}
