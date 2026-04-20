function crearPartida() {

  const select = document.getElementById("selectPista");
  const pistaId = select.value;

  if (!pistaId) {
    alert("Selecciona una pista");
    return;
  }

  return db.collection("partidas").add({
    pistaId: pistaId,
    jugadores: [],
    estado: "borrador",
    fecha: new Date()
  });

}

function cargarPistasParaPartida() {

  const select = document.getElementById("selectPista");
  if (!select) return;

  const user = auth.currentUser;

  db.collection("pistas").get().then((snapshot) => {

    let html = '<option value="">Selecciona pista</option>';

    snapshot.forEach((doc) => {

      const pista = doc.data();

      const nombre = pista.nombre || pista.nombreNorm || "Pista";
      const ubicacion = pista.localidad || pista.localidadNorm || "";

      let texto = nombre;
      if (ubicacion) texto += " - " + ubicacion;

      let disabled = "";
      if (user && pista.tipo === "Privada / Comunidad" && pista.creadaPor !== user.uid) {
        disabled = "disabled";
        texto += " (Solo propietario)";
      }

      html += '<option value="' + doc.id + '" ' + disabled + '>' + texto + '</option>';

    });

    select.innerHTML = html;

    console.log("SELECT FINAL:", select.innerHTML);

  });

}