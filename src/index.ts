export interface INewAble<T> {
  new (...a: any[]): T
}


const TypeRegister = new WeakMap<INewAble<any>, Serializer<any>>()
export type SerializerRef<T> = Serializer<T> | (new () => T)


export function serializerFor<T>(ref: SerializerRef<T>): Serializer<T> {
  if (ref instanceof Serializer) return ref
  const res = TypeRegister.get(ref)
  if (!res) throw new Error(`no serializer defined for type ${ref.name}`)
  return res
}


export function deserialize<T>(obj: any, serializer: SerializerRef<T>): T {
  const serial = serializer instanceof Serializer ? serializer : TypeRegister.get(serializer)
  if (!serial) {
    throw new Error(`...`)
  }
  return serial.deserialize(obj)
}


export function serialize<T>(obj: T, type?: INewAble<T>): any {
  const _type = type || obj.constructor as INewAble<T>
  const serial = TypeRegister.get(_type)
  if (!serial)
    throw new Error(`...`)
  return serial.serialize(obj)
}


const serialSymbol = Symbol('serializer')


export class Serializable {

  static deserialize<S extends Serializable>(this: new () => S, obj: any): S {
    const _ = (this as any)[serialSymbol] as Serializer<S>
    if (_) return _.deserialize(obj)
    return deserialize(obj, this)
  }

  serialize(): any {
    return serialize(this)
  }

}


export abstract class Serializer<T> {

  static create<T>(deserialize: (obj: any) => T, serialize: (obj: T) => any): Serializer<T> {
    return new class CustomSerializer extends Serializer<T> {
      deserialize(obj: any): T {
        return deserialize(obj)
      }
      serialize(obj: T): any {
        return serialize(obj)
      }
    }
  }

  abstract deserialize(obj: any): T

  abstract serialize(obj: T): any

  nullable(): Serializer<T | null> {
    return Serializer.create<T | null>(
      obj => obj == null ? null : this.deserialize(obj),
      obj => obj == null ? null : this.serialize(obj)
    )
  }

  optional(): Serializer<T> {
    return Serializer.create<T>(
      obj => obj === undefined ? obj : this.deserialize(obj),
      obj => obj === undefined ? obj : this.serialize(obj)
    )
  }

  or<U>(other: SerializerRef<U>) {
    return new EitherSerializer<T, U>(this, other)
  }

  register(type: INewAble<T>) {
    TypeRegister.set(type, this)
  }

  default(val: T | ((obj: any) => T)) {
    return Serializer.create<T>(
      d => {
        try {
          return this.deserialize(d)
        } catch {
          return typeof val === 'function' ? val(d) : val
        }
      },
      s => this.serialize
    )
  }

}


export class EitherSerializer<A, B> extends Serializer<A | B> {
  constructor(public first: SerializerRef<A>, public second: SerializerRef<B>) {
    super()
  }
  deserialize(obj: any): A | B {
    try {
      return serializerFor(this.first).deserialize(obj)
    } catch {
      return serializerFor(this.second).deserialize(obj)
    }
  }
  serialize(obj: A | B): any {
    try {
      return serializerFor(this.first).serialize(obj as A)
    } catch {
      return serializerFor(this.second).serialize(obj as B)
    }
  }
}


export const StringSerializer = Serializer.create<string>(
  obj => obj ? obj.toString() : '',
  obj => obj ? obj.toString() : ''
)




export class ObjectSerializer<T, Keys extends keyof T = keyof T> extends Serializer<T> {

  constructor(
    public props: {[K in Keys]: SerializerRef<T[K]>},
    public constr?: new (...a: any[]) => Partial<T>
  ) {
    super()
  }

  deserialize(obj: any): T {
    var n: any = this.constr ? new this.constr() /* Object.create(this.constr.prototype) */ : {}
    for (var k of Object.getOwnPropertyNames(this.props)) {
      n[k] = serializerFor(this.props[k as Keys]!).deserialize(obj[k])
    }
    return n
  }

  serialize(obj: T) {

  }

}


export class ArraySerializer<T> extends Serializer<T[]> {

  constructor(
    public type: SerializerRef<T>
  ) {
    super()
  }

  deserialize(obj: any): T[] {
    const r = []
    const slz = serializerFor(this.type)

    // Error reporting could be better...
    if (!Array.isArray(obj)) throw new Error(`not an array`)

    for (var ob of obj) {
      r.push(slz.deserialize(ob))
    }

    return r
  }

  serialize(obj: T[]): any[] {
    const r = []
    const slz = serializerFor(this.type)
    for (const ob of obj) {
      r.push(slz.serialize(ob))
    }
    return r
  }

}


export function object<T, Keys extends keyof T = keyof T>(
  props: {[K in Keys]: SerializerRef<T[K]>},
  constr?: new (...a: any[]) => Partial<T>
): ObjectSerializer<T> {
  return new ObjectSerializer(props, constr)
}

export const string: Serializer<string> = Serializer.create<string>(a => a ? a.toString() : '', a => a ? a.toString() : '')
export const boolean: Serializer<boolean> = Serializer.create<boolean>(a => !!a, a => !!a)

// Maybe should create an error here if we have NaN
export const number: Serializer<number> = Serializer.create<number>(a => {
  var res = parseFloat(a)
  if (Number.isNaN(res)) throw new Error('not a number')
  return res
}, a => parseFloat(a as any))

export const date: Serializer<Date> = Serializer.create<Date>(a => new Date(a), a => a.getTime())
export const regexp: Serializer<RegExp> = Serializer.create<RegExp>(a => new RegExp(a.source, a.flags),
  a => {
    return {source: a.source,
      flags: ''
        + a.sticky ? 'y' : ''
        + a.multiline ? 'm' : ''
        + a.unicode ? 'u' : ''
        + a.ignoreCase ? 'i' : ''
        + a.global ? 'g' : ''
    }
})

export function setOf<A>(type: SerializerRef<A>): Serializer<Set<A>> {
  return Serializer.create<Set<A>>(
    d => {
      if (!Array.isArray(d)) throw new Error(`Set expects an array`)
      const s = new Set<A>()
      const slz = serializerFor(type)
      for (const _ of d) s.add(slz.deserialize(_))
      return s
    },
    s => {
      const arr = Array.from(s)
      const slz = serializerFor(type)
      return arr.map(_ => slz.serialize(_))
    }
  )
}

export function mapOf<A, B>(keytype: SerializerRef<A>, valuetype: SerializerRef<B>): Serializer<Map<A,B>> {
  return Serializer.create<Map<A, B>>(
    d => {
      if (!Array.isArray(d)) throw new Error(`Set expects an array`)
      const m = new Map<A, B>()
      const slz_a = serializerFor(keytype)
      const slz_b = serializerFor(valuetype)
      for (const _ of d) m.set(slz_a.deserialize(_[0]), slz_b.deserialize(_[1]))
      return m
    },
    m => {
      const arr = Array.from(m)
      const slz_a = serializerFor(keytype)
      const slz_b = serializerFor(valuetype)
      return arr.map(_ => [slz_a.serialize(_[0]), slz_b.serialize(_[1])])
    }
  )

}


export function arrayOf<A>(type: SerializerRef<A>): ArraySerializer<A> {
  return new ArraySerializer<A>(type)
}