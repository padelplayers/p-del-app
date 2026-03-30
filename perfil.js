let unsubscribePerfil = null;
let unsubscribeUser = null;

function verPerfil(uid){

  // cancelar listeners anteriores
  if (unsubscribePerfil) unsubscribePerfil();
  if (unsubscribeUser) unsubscribeUser();

  mostrar("perfil");

  const user = auth.currentUser;
  if (!user) return;

  // BOTONES (DEFINIDOS ANTES DE USAR)
  const btnSeguir = document.getElementById("btnSeguir");
  const editarBtn = document.getElementById("btnEditar");
  const eliminarBtn = document.getElementById("btnEliminar");

  if (!btnSeguir || !editarBtn || !eliminarBtn) return;

  // MOSTRAR / OCULTAR BOTONES (CORRECTO)
  if (user.uid === uid) {
    btnSeguir.style.display = "none";
    editarBtn.style.display = "block";
    eliminarBtn.style.display = "block";
  } else {
    btnSeguir.style.display = "block";
    editarBtn.style.display = "none";
    eliminarBtn.style.display = "none";
  }

  btnSeguir.onclick = toggleSeguir;

  document.getElementById("perfil").dataset.uid = uid;

  // LISTENER PERFIL
  unsubscribePerfil = db.collection("usuarios").doc(uid).onSnapshot(doc => {

    if (!doc.exists) return;

    const data = doc.data();

    document.getElementById("nombrePerfil").innerText = data.nombre || "";
    document.getElementById("nivelPerfil").innerText = (data.nivel || 0) + " nivel";

    document.getElementById("fotoPerfil").src =
      data.fotoPerfil ? data.fotoPerfil : "https://via.placeholder.com/150";

    document.getElementById("seguidores").innerText =
      Array.isArray(data.seguidores) ? data.seguidores.length : 0;

    document.getElementById("seguidos").innerText =
      Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

  });

  // LISTENER USUARIO (estado seguir)
  unsubscribeUser = db.collection("usuarios").doc(user.uid).onSnapshot(miDoc => {

    if (!miDoc.exists) return;

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";
    btnSeguir.classList.toggle("btnYellow", !sigo);

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