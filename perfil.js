let unsubscribePerfil = null;
let unsubscribeUser = null;

function eliminarPerfil() {

  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;

  // borrar de Firestore
  db.collection("usuarios").doc(uid).delete()

    .then(() => {
      // borrar usuario de Auth
      return user.delete();
    })

    .then(() => {
      alert("Perfil eliminado");
      mostrar("login");
    })

    .catch((error) => {
      console.error(error);

      if (error.code === "auth/requires-recent-login") {
        alert("Vuelve a iniciar sesión para eliminar la cuenta");
      }
    });
}





function verPerfil(uid = auth.currentUser?.uid){

  if (unsubscribePerfil) unsubscribePerfil();
  if (unsubscribeUser) unsubscribeUser();

  mostrar("perfil");

  const user = auth.currentUser;
  if (!user) return;

  const selectNivel = document.getElementById("nivelManual");

  if (selectNivel && user.uid === uid) {
    selectNivel.disabled = true;
  }

  const perfilEl = document.getElementById("perfil");
  if (perfilEl) perfilEl.dataset.uid = uid;

  const btnSeguir = document.getElementById("btnSeguir");
  const editarBtn = document.getElementById("btnEditar");
  const eliminarBtn = document.getElementById("btnEliminar");

  // CONTROL BOTONES
  if (editarBtn) {
    editarBtn.style.display = (user.uid === uid) ? "block" : "none";
  }

  if (eliminarBtn) {
    eliminarBtn.style.display = (user.uid === uid) ? "block" : "none";
  }

  if (btnSeguir) {
    btnSeguir.style.display = (user.uid !== uid) ? "block" : "none";
    btnSeguir.onclick = toggleSeguir;
  }
}

  // LISTENER PERFIL
unsubscribePerfil = db.collection("usuarios").doc(uid).onSnapshot(doc => {

  if (!doc.exists) return;

  const data = doc.data();

  document.getElementById("nombrePerfil").innerText = data.nombre || "";
  document.getElementById("nivelPerfil").innerText = (data.nivel || 0) + " nivel";

  document.getElementById("fotoPerfil").src =
    data.fotoPerfil || "imagen/hombre.jpeg";

  document.getElementById("seguidores").innerText =
    Array.isArray(data.seguidores) ? data.seguidores.length : 0;

  document.getElementById("seguidos").innerText =
    Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

});


// GUARDAR UID DEL PERFIL
const uidPerfil = uid;


// LISTENER USUARIO
unsubscribeUser = db.collection("usuarios").doc(user.uid).onSnapshot(miDoc => {

  if (!miDoc.exists) return;

  const perfilActual = document.getElementById("perfil").dataset.uid;
  if (!perfilActual) return;

  const siguiendo = miDoc.data()?.siguiendo || [];
  const sigo = siguiendo.includes(perfilActual);

  if (btnSeguir) {
    btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";
    btnSeguir.classList.toggle("btnYellow", !sigo);
  }

});



function toggleSeguir(){

  const btnSeguir = document.getElementById("btnSeguir");
  if (btnSeguir) btnSeguir.disabled = true;

  const user = auth.currentUser;
  if (!user) return;

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
      ]);

    } else {

      return Promise.all([
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayUnion(uid)
        }),
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
        })
      ]);

    }

  }).finally(() => {
    if (btnSeguir) btnSeguir.disabled = false;
  });

}
