export interface INewAble<T> {
  new (...a: any[]): T
}


const TypeRegister = new WeakMap<INewAble<any>, Serializer<any>>()


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


export function validate(obj: any, type?: INewAble<any>): boolean {
  const serial = TypeRegister.get(type || obj.constructor)
  if (!serial)
    throw new Error(`...`)
  return serial.validate(obj)
}


/**
 *
 * @param type
 * @param serialize
 * @param deserialize
 */
function register<T>(type: (new (...a: any[]) => T), serialize: (obj: T) => any, deserialize: (obj: any) => T) {

}


register(
  Date,
  d => d.getTime(),
  d => new Date(d)
)

interface SerializedRegexp {
  source: string
  flags: string
}

register(
  RegExp,
  r => { return {source: r.source, flags: r.flags} as SerializedRegexp },
  (r: SerializedRegexp) => new RegExp(r.source, r.flags)
)

register(
  Number,
  n => n,
  n => parseFloat(n)
)

register(
  Boolean,
  n => !!n,
  n => !!n
)

register(
  String,
  s => s.toString(),
  s => s.toString()
)


const serialSymbol = Symbol('serializer')


export class Serializable {

  static deserialize<S extends Serializable>(this: new () => S, obj: any): S {
    const _ = (this as any)[serialSymbol] as ISerializer<S>
    if (_) return _.deserialize(obj)
    return deserialize(obj, this)
  }

  serialize(): any {
    return serialize(this)
  }

  validates(): boolean {
    return validate(this)
  }

}


export abstract class Serializer<T> {

  constraints: ((obj: T) => boolean)[] = []

  clone(): this {
    var n = Object.create(this.constructor.prototype)
    n.constraints = this.constraints.slice()
    return n
  }

  abstract deserialize(obj: any): T

  abstract serialize(obj: T): any

  validate(obj: T): boolean {
    for (var c of this.constraints) {
      if (!c(obj)) return false
    }
    return true
  }

  addConstraint(fn: (obj: T) => boolean): this {
    var n = this.clone()
    n.constraints.push(fn)
    return n
  }

}


export type SerializerRef<T> = Serializer<T> | (new (...a: any[]) => T)


export class ObjectSerializer<T> extends Serializer<T> {

  constructor(
    public props: {[K in keyof T]: SerializerRef<T[K]>},
    public constr?: new (...a: any[]) => T
  ) {
    super()
  }

  deserialize(obj: any): T {
    var n = this.constr ? Object.create(this.constr.prototype) : {}
    for (var k of Object.getOwnPropertyNames(this.props)) {
      n[k] = this.props[k].deserialize(obj[k])
    }
    return n
  }

  serialize(obj: T) {

  }

}

export class ArraySerializer<T> extends Serializer<T[]> {

  constructor(
    public type: Serializer<T>
  ) {
    super()
  }

}