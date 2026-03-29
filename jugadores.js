function cargarJugadores(){

  const contenedor = document.getElementById("listaJugadores");
  contenedor.innerHTML = "";

  db.collection("usuarios").get().then(snapshot => {

    snapshot.forEach(doc => {

      const data = doc.data();

      const div = document.createElement("div");
      div.className = "jugadorCard";

      div.innerHTML = `
  <div>
    <img src="${data.fotoPerfil || 'imagen/hombre.jpeg'}" width="50" />
    <span>${data.nombre}</span>
  </div>
`;

      div.onclick = () => verPerfil(doc.id);

      contenedor.appendChild(div);

    });

  });

}

function abrirJugadores(){
  mostrar("jugadores");
  cargarJugadores();
}

window.cargarJugadores = cargarJugadores;
window.abrirJugadores = abrirJugadores;