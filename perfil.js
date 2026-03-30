let unsubscribePerfil = null;
let unsubscribeSeguimiento = null;


function verPerfil(uid){

  mostrar("perfil");

  const user = auth.currentUser;
  document.getElementById("perfil").dataset.uid = uid;

  const btnSeguir = document.getElementById("btnSeguir");

  // ESCUCHA ÚNICA DEL PERFIL
  db.collection("usuarios").doc(uid).onSnapshot(doc => {

    if (!doc.exists) return;

    const data = doc.data();

    // render perfil
    document.getElementById("nombrePerfil").innerText = data.nombre || "";
    document.getElementById("nivelPerfil").innerText = (data.nivel || 0) + " nivel";
    document.getElementById("fotoPerfil").src = data.fotoPerfil || "imagen/hombre.jpeg";

    document.getElementById("seguidores").innerText =
      Array.isArray(data.seguidores) ? data.seguidores.length : 0;

    document.getElementById("seguidos").innerText =
      Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

  });

  // ESTADO BOTÓN (separado, pero SOLO lectura de tu usuario)
  db.collection("usuarios").doc(user.uid).onSnapshot(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";

  });

  // mostrar / ocultar botón
  if (user.uid === uid) {
    btnSeguir.style.display = "none";
  } else {
    btnSeguir.style.display = "block";
  }

}

  // estado seguir (TIEMPO REAL)
  

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

    

  });

}