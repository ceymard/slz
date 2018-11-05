
// By default, all serializers can return undefined if the value did not exist. ????
// var s = string().from('pouet') // 'pouet'
// var s = string().stringify().from({what: true}) // `{"what": true}`
// var s = string().from(undefined) // undefined
// var s = string('pouet').from(undefined) // 'pouet'
// var s = string('pouet').from(null) // 'pouet'
// var s = string().nullable().from(null) // null
// var s = string(null).from(null) // null
// var s = string(null).from('pouet') // 'pouet' as string | null

// How do I handle absent values ?
// How do I handle the fact that a field may be computed from other fields from the source ?
// I need the serializer to be complete.


/**
 * A very basic cloning function
 * @param base the base object
 * @param newprops new properties to add to the object
 */
export function clone<T>(base: T, newprops: {[K in keyof T]?: T[K]}) {
  var res = Object.create(base.constructor)
  for (var x in base) {
    res[x] = base[x]
  }
  for (x in newprops) {
    res[x] = newprops[x]
  }
  return res
}


export class Builder<T> {

  public _help: string = ''

  // Just to be used as typeof s.TYPE
  public TYPE!: T

  public base_class: Function = this.constructor

  from(unk: unknown): T {
    return unk as T
  }

  default(def: T): Builder<NonNullable<T>>
  default(def: null): Builder<NonNullable<T> | null>
  default(def: T | null) {
    return this.transform((v) => {
      return v !== undefined ? v : def
    })
  }

  required(): Builder<NonNullable<T>> {
    return this.transform((v) => {
      var res = v
      if (res == undefined)
        throw new Error(`this reader requires a value`)
      return res as NonNullable<T>
    })
  }

  or<U>(spec: Builder<U>): Builder<T | U> {
    return this.transform(v => {
      try {
        return v
      } catch {
        return spec.from(v)
      }
    })
  }

  when<K extends keyof T, V extends T[K], U>(key: K, value: V, ser: Builder<U>) {

  }

  transform<U>(fn: (v: unknown) => U): Builder<U> {
    return new TransformBuilder(this, fn)
  }

  help(): string
  help(tpl: string): this
  help(tpl: TemplateStringsArray): this
  help(tpl?: TemplateStringsArray | string) {
    if (typeof tpl === 'undefined')
      return this._help
    return clone(this as Builder<T>, {_help: typeof tpl === 'string' ? tpl : tpl[0]})
  }

}


export class TransformBuilder<T, U> extends Builder<U> {
  constructor(public orig: Builder<T>, public fn: (value: unknown) => U) {
    super()
    this._help = orig._help
    this.base_class = orig.constructor
  }

  from(v: unknown): U {
    return this.fn(v)
  }
}



export type ObjectBuilderProps<T> = {[K in keyof T]: Builder<T[K]>}


export class ObjectBuilder<T extends object> extends Builder<T> {

  props<U>(props: ObjectBuilderProps<U>): ObjectBuilder<T & U> {

  }

  /**
   * Specify properties that are *optional* on the deserialized type.
   * They can have defaults and not be undefined in the end, but
   * this method exists for those types you want to deserialize to
   * that have optional properties.
   *
   * Optional properties on target type are the *only* ones that should
   * be present here. All the rest should go to props.
   *
   * @param props The properties that are to be tagged as optional
   */
  optional<U>(props: ObjectBuilderProps<U>): ObjectBuilder<T & {[k in keyof U]?: U[k]}> {

  }

  /**
   *
   * @param typ The class this deserializer should give an object of.
   * @param typcheck2 Give this parameter the exact same value as `typ`.
   *  It is unused at runtime but serves for more type verification with
   *  typescript, to ensure that there are no excess properties in the current
   *  object specification.
   */
  createAs<T extends object, U extends T, V extends U = U>(
    this: Builder<U>,
    typ: new (...a: any[]) => T,
    typcheck2?: new (...a: any) => V
  ): ObjectBuilder<T> {
  // createAs<U extends T>(typ: new (...a: any[]) => U): ObjectSerializer<U> {
      return null!
  }

  index<V>(values: Builder<V>): ObjectBuilder<{[n: string]: V}> {
    return null!
  }

  from(t: unknown): T {
    return t as T
  }

}


export class ArrayBuilder<T> extends Builder<T[]> {

}

export class IndexBuilder<T> extends Builder<T> {

}

export class TupleBuilder<T extends any[]> extends Builder<T | undefined> {
  constructor(public builders: {[K in keyof T]: Builder<T[K]>}) {
    super()
  }
}


export class BooleanBuilder extends Builder<boolean | undefined> {

  from(t: unknown) {
    return t !== undefined ? !!t : undefined
  }

}

export class StringBuilder extends Builder<string | undefined> {
  from(t: unknown) {
    if (t == null) return undefined
    // FIXME check that t is indeed a string.
    return (t as any).toString() as string
  }

  serialize(t: string) {
    return t
  }
}

export class NumberBuilder extends Builder<number | undefined> {

  from(t: unknown) {
    if (typeof t === 'number')
      return t
    if (typeof t === 'string') {
      return parseFloat(t) || parseInt(t, 16)
    }
    throw new Error('not a number')
  }

}


export function number(n: null): Builder<number | null>
export function number(def: number): Builder<number>
export function number(): Builder<number | undefined>
export function number(def?: any): Builder<any> {
  var res = new NumberBuilder()
  if (def !== undefined)
    return res.default(def)
  return res
}


export function string(): Builder<string | undefined>
export function string(def: null): Builder<string | null>
export function string(def: string): Builder<string>
export function string(def?: string | null): Builder<string | null | undefined> {
  var res = new StringBuilder()
  if (def !== undefined)
    return res.default(def!)
  return res
}


export function object(): ObjectBuilder<object>
export function object<T extends object>(specs: ObjectBuilderProps<T>): ObjectBuilder<T>
export function object<T extends object>(specs: ObjectBuilderProps<T>, inst?: new (...a: any[]) => T): Builder<T>
export function object<T extends object>(specs?: ObjectBuilderProps<T>, inst?: new (...a: any[]) => T): ObjectBuilder<any> {
  var res = new ObjectBuilder<T>()
  if (specs)
    res = res.props(specs)
  if (inst)
    res = res.createAs(inst)
  return res
}


export function indexed<T>(items: Builder<T>): Builder<{[name: string]: T}> {
  return null!
}


export type Unserializify<T> = T extends Builder<infer U> ? U : T


export function tuple<Arr extends Builder<any>[]>(...sers: Arr): Builder<{[K in keyof Arr]: Unserializify<Arr[K]>}> {
  return null!
}


export function array<T>(items: Builder<T>): Builder<T[] | undefined> {
  return null!
}


export function boolean(): BooleanBuilder
export function boolean(def: boolean): Builder<boolean>
export function boolean(def?: boolean) {
  var res = new BooleanBuilder()
  if (def !== undefined)
    return res.default(def)
  return res
}


