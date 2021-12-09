require('./index.css')
const ele = document.createElement('div')
ele.classList.add('hello')
ele.innerHTML = 'hello';
document.body.appendChild(ele)

const ele2 = document.createElement('div')
ele2.classList.add('world')
ele2.innerHTML = 'world';
document.body.appendChild(ele2)