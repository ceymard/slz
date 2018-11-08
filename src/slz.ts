
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
function clone<T>(base: T, newprops: {[K in keyof T]?: T[K]}) {
  var res = Object.create(base.constructor)
  for (var x in base) {
    res[x] = base[x]
  }
  for (x in newprops) {
    res[x] = newprops[x]
  }
  return res
}


export class Result<T> {
  constructor(
  public value: T | undefined,
  public original: unknown,
  public errors: string[] | undefined
  ) { }

  isOk(): this is Ok<T> {
    return this.errors === undefined
  }

  isError(): this is Err {
    return this.errors !== undefined
  }

  ok<U>(value: U): Ok<U> {
    return new Result(value, this.original, undefined) as Ok<U>
  }

  err(error: string): Err {
    return new Result(undefined, this.original, [...(this.errors||[]), error]) as Err
  }
}

export interface Ok<T> extends Result<T> {
  value: T
  errors: undefined
}

export interface Err extends Result<any> {
  value: undefined
  errors: string[]
}

function err(v: unknown, err: string | string[]): Err {
  return new Result(undefined, v, Array.isArray(err) ? err : [err]) as Err
}

function ok<T>(v: unknown, value: T): Ok<T> {
  return new Result(value, v, undefined) as Ok<T>
}


export class Builder<T> {

  public _help: string = ''

  // Just to be used as typeof s.TYPE
  public TYPE!: T

  public base_class: Function = this.constructor

  from(unk: unknown): Result<T> {
    return ok(unk, unk as any) as Result<any>
  }

  optional(): Builder<T | undefined> {
    return this.transform(res => {
      if (res.errors)
        return res.ok(undefined)
      return res
    })
  }

  default<U = T>(def: U): Builder<T | U> {
    // I do not know why this is failing
    // @ts-ignore
    return this.catch(res => res.ok(def))
  }

  or<U>(spec: Builder<U>): Builder<T | U> {
    return this.transform(res => {
      if (res.errors) {
        return spec.from(res.original)
      }
      return res as Result<T | U>
    })
  }

  when<K extends keyof T, V extends T[K], U>(key: K, value: V, ser: Builder<U>) {

  }

  transform<U>(fn: (v: Result<T>) => Result<U>): Builder<U> {
    return new TransformBuilder(this, fn)
  }

  then<U = T>(fn: (v: Ok<T>) => U): Builder<U> {
    return this.transform(res => {
      if (res.isOk())
        return res.ok(fn(res))
      return res as Err
    })
  }

  catch(fn: (v: Err) => Result<T>): Builder<T> {
    return this.transform(res => {
      if (res.isError())
        return fn(res)
      return res
    })
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
  constructor(public orig: Builder<T>, public fn: (result: Result<T>) => Result<U>) {
    super()
    this._help = orig._help
    this.base_class = orig.constructor
  }

  from(v: unknown): Result<U> {
    var orig = this.orig.from(v)
    return this.fn(orig)
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
  optionals<U>(props: ObjectBuilderProps<U>): ObjectBuilder<T & {[k in keyof U]?: U[k]}> {

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

  from(t: unknown) {
    if (typeof t !== 'object')
      return err(t, 'not an object')
    // This is quite incorrect
    return ok(t, {} as T)
  }

}


export class ArrayBuilder<T> extends Builder<T[]> {

  constructor(public builder: Builder<T>) {
    super()
  }

  from(v: unknown) {
    if (!Array.isArray(v))
      return err(v, 'should be an array')
    var res: T[] = new Array(v.length)
    var b = this.builder
    for (var i = 0; i < res.length; i++) {
      var arrres = b.from(v[i])
      if (arrres.isError())
        return err(v, arrres.errors.map(e => `${i}: ${e}`))
      res[i] = arrres.value as T
    }
    return ok(v, res)
  }

}

export class IndexBuilder<T> extends Builder<T> {

}

export class TupleBuilder<T extends any[]> extends Builder<T> {
  constructor(public builders: {[K in keyof T]: Builder<T[K]>}) {
    super()
  }

  from(t: unknown) {
    if (!Array.isArray(t))
      return err(t, 'should be an array')
    if (t.length !== this.builders.length)
      return err(t, 'array is not the right length')
    var res: T = new Array(this.builders.length) as T
    for (var i = 0; i < res.length; i++) {
      var tupres = this.builders[i].from(t[i])
      if (tupres.isError()) {
        return err(t, `prop ${i}: ${tupres.errors}`)
      }
      res[i] = tupres.value
    }
    return ok(t, res)
  }
}


export class BooleanBuilder extends Builder<boolean> {

  from(t: unknown) {
    if (t === true || t === false)
      return ok(t, t as boolean)
    return err(t, 'not a boolean')
  }

  /**
   * Try to guess the value of the boolean from the input using the !! operator
   */
  coerce() {
    return this.catch(res => res.ok(!!res.original))
  }

}

export class StringBuilder extends Builder<string> {
  from(t: unknown) {
    if (typeof t !== 'string')
      return err(t, 'not a string')
    return ok(t, t as string)
  }

  coerce() {
    return this.catch(res => {
      if (res.original == null)
        return res // keep the error
      return res.ok((res.original as object).toString())
    })
  }

}

export class NumberBuilder extends Builder<number> {

  from(t: unknown) {
    if (typeof t === 'number')
      return ok(t, t as number)
    return err(t, 'not a number')
  }

  /**
   * Try to parse a number even if it was a string.
   */
  coerce() {
    return this.catch(err => {
      if (typeof err.original !== 'string')
        return err // keep the original error
      var orig = err.original as any
      var newv = parseFloat(orig) || parseInt(orig, 16)
      return err.ok(newv)
    })
  }

}


export function number(n: null): Builder<number | null>
export function number(def: number): Builder<number>
export function number(): Builder<number>
export function number(def?: any): Builder<any> {
  var res = new NumberBuilder()
  if (arguments.length > 0)
    return res.default(def)
  return res
}


export function string(): Builder<string>
export function string<T>(def: T): Builder<string | T>
export function string(def?: any): Builder<any> {
  var res = new StringBuilder()
  if (arguments.length > 0)
    return res.default(def)
  return res
}


export function object<T extends object>(specs: ObjectBuilderProps<T>): ObjectBuilder<T>
export function object(): ObjectBuilder<object>
export function object<T extends object>(specs?: ObjectBuilderProps<T>): ObjectBuilder<any> {
  var res = new ObjectBuilder<T>()
  if (specs)
    return res.props(specs)
  return res
}


export function any() {
  return new Builder<any>()
}


export function indexed<T>(items: Builder<T>): Builder<{[name: string]: T}> {
  throw new Error('not implemented')
  return null!
}


export type Unserializify<T> = T extends Builder<infer U> ? U : T


export function tuple<Arr extends Builder<any>[]>(...builders: Arr): Builder<{[K in keyof Arr]: Unserializify<Arr[K]>}> {
  // @ts-ignore : this is correct, but it's getting complicated to have the type system agree with me.
  return new TupleBuilder(builders)
}


export function array<T>(items: Builder<T>): Builder<T[]> {
  return new ArrayBuilder(items)
}


export function boolean(): BooleanBuilder
export function boolean(def: boolean): Builder<boolean>
export function boolean(def?: boolean) {
  var res = new BooleanBuilder()
  if (def !== undefined)
    return res.default(def)
  return res
}
