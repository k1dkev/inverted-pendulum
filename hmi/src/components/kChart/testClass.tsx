interface TestInterface {}

class TestClass {
  readonly myVar: number = 1;
}

var myTestClass = new TestClass();
myTestClass.myVar = 2;

export { TestClass as default };
