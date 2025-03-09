export class TagManager {
    constructor() {
        this.tags = new Map(); // Map<string, {text: string, color: string}>
        this.loadTags();
    }

    loadTags() {
        chrome.storage.local.get('globalTags', (data) => {
            this.tags = new Map(Object.entries(data.globalTags || {}));
        });
    }

    saveTags() {
        const tagsObject = Object.fromEntries(this.tags);
        chrome.storage.local.set({ globalTags: tagsObject });
    }

    addTag(text, color) {
        if (!this.tags.has(text)) {
            this.tags.set(text, { text, color });
            this.saveTags();
        }
        return this.tags.get(text);
    }

    removeTag(text) {
        if (this.tags.has(text)) {
            this.tags.delete(text);
            this.saveTags();
        }
    }

    getTag(text) {
        return this.tags.get(text);
    }

    getAllTags() {
        return Array.from(this.tags.values());
    }

    updateTagColor(text, color) {
        if (this.tags.has(text)) {
            this.tags.set(text, { text, color });
            this.saveTags();
        }
    }
}

export const tagManager = new TagManager();