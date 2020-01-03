/**
console.log(' 画面サイズの横幅 ');
console.log(window.parent.screen.width);

console.log(' 画面サイズの高さ ');
console.log(window.parent.screen.height);

console.log(`ウィンドウサイズの横幅`);
console.log(window.innerWidth);

console.log(`ウィンドウサイズの高さ`);
console.log(window.innerHeight);
 */

function init() {
    var element = document.getElementById('model');
    element.style.height = `${window.innerHeight}px`;
}

window.addEventListener('resize', () => {
    console.log('resize');
    init();
});

init();
