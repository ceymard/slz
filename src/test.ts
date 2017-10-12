import * as s from './index'

class Test2 {
  a: string
  b: string = '3'
}

const t1 = s.object({a: s.string}, Test2)
t1.register(Test2)


// Either call the autoserializer, or define a custom one...
class Test extends s.Serializable {

  str: string | null

  set: Set<number> | Set<string> | number

  map: Map<Test2, string> | null

  tests: Test2[] | null
}

const tt = s.object({
  str: s.string.nullable().optional(),
  set: s.setOf(s.number).or(s.setOf(s.string)).or(s.number).default(5),
  map: s.mapOf(Test2, s.string).nullable(),
  tests: s.arrayOf(Test2).nullable()
}, Test)


var t = tt.deserialize({str: 'zobi', tests: [{a: '84'}], map: [ [{a: '23'}, 'zobi'] ]})
console.log(t)
// const test = s.object({a: s.number})
// test.serialize({a: 2})
