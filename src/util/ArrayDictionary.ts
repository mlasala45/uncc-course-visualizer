export default class ArrayDictionary<K, V> {
    #keyGetter: (item: V) => K
    #keyEquals: (k0: K, k1: K) => boolean
    #keyToString?: ((key: K) => string)
    #array: V[]

    constructor(options: ArrayDictionaryOptions<K, V>, array?: V[]) {
        this.#keyGetter = options.keyGetter;
        this.#keyEquals = options.keyEquals
        this.#keyToString = options.keyToString
        this.#array = array || []
    }

    /** Overwrites the contents of the dictionary with a copy of the provided array. */
    loadFromArray(array: V[]) {
        this.#array = [...array]
    }

    clear() {
        this.#array = []
    }

    #getPredicate(key: K) { return (item: V) => this.#keyEquals(this.#keyGetter(item), key) }

    get(key: K): V | undefined {
        return this.#array.find(this.#getPredicate(key))
    }

    containsKey(key: K) {
        if (key === undefined) return false
        return this.get(key) != null
    }

    set(value: V) {
        const key = this.#keyGetter(value)
        const index = this.#array.findIndex(this.#getPredicate(key))
        if (index == -1) {
            this.#array.push(value)
        }
        else {
            this.#array[index] = value
        }
    }

    add(value: V) {
        const key = this.#keyGetter(value)
        if (this.get(key)) {
            const keyStr = this.#keyToString ? this.#keyToString(key) : `${key}`
            throw new Error(`Dictionary already has key: ${keyStr}`)
        }
        this.set(value)
    }

    remove(key: K) {
        const keyStr = this.#keyToString ? this.#keyToString(key) : `${key}`
        const index = this.#array.findIndex(this.#getPredicate(key))
        if (index != -1) {
            this.#array.splice(index, 1)
        }
    }

    count() {
        return this.#array.length
    }

    map<U>(callbackfn: (value: V, index: number) => U) {
        this.#validate()
        return this.#array.map(callbackfn)
    }
    
    #validate() {
        if(!this.#array) {
            throw new Error(`#array is ${this.#array} for ArrayDictionary on operation!`)
        }
    }
}

interface ArrayDictionaryOptions<K, V> {
    keyGetter: (item: V) => K,
    keyEquals: (k0: K, k1: K) => boolean,
    keyToString?: (key: K) => string
}