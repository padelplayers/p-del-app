function cargarJugadores(){

  const contenedor = document.getElementById("listaJugadores");
  contenedor.replaceChildren();

  db.collection("usuarios").get().then(snapshot => {

    snapshot.forEach(doc => {

      const data = doc.data();

      const div = document.createElement("div");
      div.className = "jugadorCard";

      const contenido = document.createElement("div");

      const img = document.createElement("img");
      img.className = "jugadorFoto";
      img.src = data.fotoPerfil || (data.sexo === "femenino" ? "imagen/mujer.jpeg" : "imagen/hombre.jpeg");
      img.width = 50;

      const nombre = document.createElement("span");
      nombre.className = "jugadorNombre";
      nombre.textContent = data.nombre || "";

      contenido.appendChild(img);
      contenido.appendChild(nombre);
      div.appendChild(contenido);

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
