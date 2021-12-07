const { SyncBailHook } = require('tapable')

const hook = new SyncBailHook(['compilation'])
hook.tap('plugin1', (compilation) => {
  console.log('plugin1')
  compilation.sum = compilation.sum + 1
})

hook.tap('plugin2', (compilation) => {
  console.log('plugin2')
  // throw Error('plugin2 抛出错误..')
  compilation.sum = compilation.sum + 2
  return 'haha'; // 除了返回undefined以外，任何值都会中断插件继续往后执行
})

hook.tap('plugin3', (compilation) => {
  console.log('plugin3')
  compilation.sum = compilation.sum + 3
})

const compilation = { sum: 0 }
// 第一种触发方式：通过call触发
// hook.call(compilation)

// 第二种触发方式：通过callAsync
// hook.callAsync(compilation, (error , result) => {
//   // 如果插件内部发生错误，则不会执行后续的插件，并将错误赋值给error
//   console.log('最终回调完成..', error, result)
// })
// 第三种触发方式：通过promise
hook.promise(compilation).then(res => {
   console.log('最终回调...',res)
}, err => {
   console.log('出错了。。。', err)
})

console.log('执行完成', compilation)


