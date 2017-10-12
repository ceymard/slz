import {Serializable, ISerializer} from './index'

class Test2 {

}

const tt: ISerializer<{
  str: string, set: Set<number>
}> = null!


// Either call the autoserializer, or define a custom one...
@autoserializer
class Test extends Serializable {

  str: string

  set: Set<number>

  map: Map<Test2, string>

  tests: Test2[]
}

var t = Test.deserialize({})
const test = s.object({a: s.set(Test2)})
test.serialize({a: 1})
