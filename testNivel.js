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

const niveles = obtenerNivelesRegistro().map(Number);

let masCercano = niveles[0];
let diferencia = Math.abs(nivel - masCercano);

for (let i = 1; i < niveles.length; i++) {
  const diff = Math.abs(nivel - niveles[i]);
  if (diff < diferencia) {
    diferencia = diff;
    masCercano = niveles[i];
  }
}

seleccionarNivelManualRegistro(String(masCercano));
document.getElementById("nivelResultado").innerText="Nivel sugerido: "+nivel;

mostrar("perfilCompletar");
document.getElementById("testNivel").style.display = "none";


}
