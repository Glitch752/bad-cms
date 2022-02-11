var prevScrollpos = window.pageYOffset;
var navbarHeight = getComputedStyle(document.documentElement).getPropertyValue('--navbar-height-negative');
console.log(navbarHeight);
window.onscroll = function() {
  var currentScrollPos = window.pageYOffset;
  if (prevScrollpos > currentScrollPos) {
    document.getElementById("navbar").style.opacity = "1";
    document.getElementById("navbar").style.top = "0";
  	if(currentScrollPos > 50) {
      document.getElementById("navbar").style.backgroundColor = "#24262E";
    } else {
      document.getElementById("navbar").style.backgroundColor = "rgba(36, 38, 46, 0)";
    }
  } else {
    document.getElementById("navbar").style.top = navbarHeight;
    document.getElementById("navbar").style.opacity = "0";
  }
  prevScrollpos = currentScrollPos;
}