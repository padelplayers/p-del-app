function abrirTest(){mostrar("testNivel")}
function cerrarTest(){mostrar("perfilCompletar")}

function calcularNivel(){

let puntos=
parseInt(p1.value)+
parseInt(p2.value)+
parseInt(p3.value)+
parseInt(p4.value)+
parseInt(p5.value)+
parseInt(p6.value)+
parseInt(p7.value)+
parseInt(p8.value);

let nivel = (puntos/32)*7;
nivel = parseFloat(nivel.toFixed(2));

const niveles = [0.5,0.75,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,3.75,4,4.25,4.5];

let masCercano = niveles[0];
let diferencia = Math.abs(nivel - masCercano);

for (let i = 1; i < niveles.length; i++) {
  const diff = Math.abs(nivel - niveles[i]);
  if (diff < diferencia) {
    diferencia = diff;
    masCercano = niveles[i];
  }
}

document.getElementById("nivelManual").value = masCercano;
document.getElementById("nivelResultado").innerText="Nivel sugerido: "+nivel;

mostrar("perfilCompletar");
document.getElementById("testNivel").style.display = "none";


}