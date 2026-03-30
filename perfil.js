let unsubscribePerfil = null;
let unsubscribeUser = null;

function verPerfil(uid){

  if (unsubscribePerfil) unsubscribePerfil();
  if (unsubscribeUser) unsubscribeUser();

  mostrar("perfil");

  const user = auth.currentUser;
  if (!user) return;

  document.getElementById("perfil").dataset.uid = uid;

  const btnSeguir = document.getElementById("btnSeguir");
  const editarBtn = document.getElementById("btnEditar");
  const eliminarBtn = document.getElementById("btnEliminar");

  if (btnSeguir) {
    btnSeguir.onclick = toggleSeguir;
  }

  // SOLO CONTROL VISUAL (sin bloquear nada)
  if (user.uid === uid) {
    if (btnSeguir) btnSeguir.style.display = "none";
    if (editarBtn) editarBtn.style.display = "block";
    if (eliminarBtn) eliminarBtn.style.display = "block";
  } else {
    if (btnSeguir) btnSeguir.style.display = "block";
    if (editarBtn) editarBtn.style.display = "none";
    if (eliminarBtn) eliminarBtn.style.display = "none";
  }

  unsubscribePerfil = db.collection("usuarios").doc(uid).onSnapshot(doc => {

    if (!doc.exists) return;

    const data = doc.data();

    document.getElementById("nombrePerfil").innerText = data.nombre || "";
    document.getElementById("nivelPerfil").innerText = (data.nivel || 0) + " nivel";

    document.getElementById("fotoPerfil").src =
      data.fotoPerfil || "https://via.placeholder.com/150";

    document.getElementById("seguidores").innerText =
      Array.isArray(data.seguidores) ? data.seguidores.length : 0;

    document.getElementById("seguidos").innerText =
      Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

  });

  unsubscribeUser = db.collection("usuarios").doc(user.uid).onSnapshot(miDoc => {

    if (!miDoc.exists) return;

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    if (btnSeguir) {
      btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";
      btnSeguir.classList.toggle("btnYellow", !sigo);
    }

  });

}


function toggleSeguir(){

  const btnSeguir = document.getElementById("btnSeguir");
  btnSeguir.disabled = true;

  const user = auth.currentUser;
  const uid = document.getElementById("perfil").dataset.uid;

  const miRef = db.collection("usuarios").doc(user.uid);
  const otroRef = db.collection("usuarios").doc(uid);

  return miRef.get().then(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    if (sigo) {

      return Promise.all([
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayRemove(uid)
        }),
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayRemove(user.uid)
        })
      ]).then(() => {
        btnSeguir.disabled = false;
      }).catch(() => {
        btnSeguir.disabled = false;
      });

    } else {

      return Promise.all([
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayUnion(uid)
        }),
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
        })
      ]).then(() => {
        btnSeguir.disabled = false;
      }).catch(() => {
        btnSeguir.disabled = false;
      });

    }

  });

}