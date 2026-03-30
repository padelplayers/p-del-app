let unsubscribePerfil = null;
let unsubscribeSeguimiento = null;


function verPerfil(uid){

  mostrar("perfil");

  const user = auth.currentUser;
  document.getElementById("perfil").dataset.uid = uid;

  const btnSeguir = document.getElementById("btnSeguir");
  const botones = document.querySelector(".perfil-botones");

  const editarBtn = botones.children[0];
  const eliminarBtn = botones.children[2];

  // mostrar / ocultar botones
  if (uid === user.uid) {
    btnSeguir.style.display = "none";
    editarBtn.style.display = "block";
    eliminarBtn.style.display = "block";
  } else {
    btnSeguir.style.display = "block";
    editarBtn.style.display = "none";
    eliminarBtn.style.display = "none";
  }

  // cargar datos del perfil
  db.collection("usuarios").doc(uid).onSnapshot(doc => {


    if (!doc.exists) return;

    const data = doc.data();

    document.getElementById("nombrePerfil").innerText = data.nombre || "";
    document.getElementById("nivelPerfil").innerText = (data.nivel || 0) + " nivel";
    document.getElementById("fotoPerfil").src = data.fotoPerfil || "imagen/hombre.jpeg";

    document.getElementById("seguidores").innerText =
      Array.isArray(data.seguidores) ? data.seguidores.length : 0;

    document.getElementById("seguidos").innerText =
      Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

  });

  // estado seguir (TIEMPO REAL)
  db.collection("usuarios").doc(user.uid).onSnapshot(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";

  });

}

function toggleSeguir(){

  const user = auth.currentUser;
  const uid = document.getElementById("perfil").dataset.uid;

  const miRef = db.collection("usuarios").doc(user.uid);
  const otroRef = db.collection("usuarios").doc(uid);

  miRef.get().then(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    let promesas = [];

    if (sigo) {

      promesas.push(
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayRemove(uid)
        })
      );

      promesas.push(
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayRemove(user.uid)
        })
      );

    } else {

      promesas.push(
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayUnion(uid)
        })
      );

      promesas.push(
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
        })
      );

    }

    Promise.all(promesas).then(() => {

  const seguidoresElem = document.getElementById("seguidores");
  const seguidosElem = document.getElementById("seguidos");

  let seguidores = parseInt(seguidoresElem.innerText) || 0;
  let seguidos = parseInt(seguidosElem.innerText) || 0;

  if (sigo) {
    // estabas siguiendo → ahora dejas de seguir
    seguidoresElem.innerText = seguidores - 1;
    seguidosElem.innerText = seguidos - 1;
  } else {
    // no seguías → ahora sigues
    seguidoresElem.innerText = seguidores + 1;
    seguidosElem.innerText = seguidos + 1;
  }

});

  });

}