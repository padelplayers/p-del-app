function cargarPistasParaPartida() {

  const user = auth.currentUser;

  db.collection("pistas").get().then((snapshot) => {

    const select = document.getElementById("selectPista");
    select.innerHTML = "<option value=''>Selecciona pista</option>";

    snapshot.forEach((doc) => {

      const pista = doc.data();

      const option = document.createElement("option");
      option.value = doc.id;

      option.textContent = pista.nombre + " - " + pista.localidad;

      if (pista.tipo === "Privada / Comunidad" && pista.creadaPor !== user.uid) {
        option.disabled = true;
        option.textContent += " (Solo propietario)";
      }

      select.appendChild(option);

    });

  });

}