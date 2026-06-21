# Auditoria final prepublicacion

Fecha: 2026-06-21

## Alcance y limite decisivo

Se ha auditado el codigo cargado por `index.html`. El workspace no contiene
`firestore.rules`, `storage.rules`, `firebase.json` ni `.firebaserc`. Por tanto,
no es posible comparar ni desplegar las reglas reales del proyecto desde esta
copia. Las reglas de este documento son propuestas exactas, no reglas aplicadas.

No se deben publicar reglas nuevas sin probarlas contra los 14 flujos de la
matriz final. Firestore no permite ocultar un campo concreto de un documento:
si un usuario puede leer `usuarios/{uid}`, puede leer todos sus campos.

## A. Fallos reales

1. `usuarios/{uid}` guarda `email` al crear el documento incompleto y al
   completar el perfil. Ademas, Chat mantiene una consulta legacy por email.
   Como `usuarios` se consulta para Jugadores y Clasificacion, cualquier regla
   que permita esas pantallas expone el email completo.
2. El contador del encabezado no intenta leer
   `estadisticas_globales/resumen`: `cargarContadorJugadoresHeader()` crea a
   proposito una promesa rechazada y siempre consulta todos los perfiles
   completos.
3. El alta y la baja de usuarios normales no mantienen el resumen. Las dos
   operaciones salen sin escribir cuando `esAdmin !== true`. Cambiar el header
   para confiar ahora en el resumen podria mostrar un total obsoleto.
4. Estadisticas admin considera activo cualquier documento que no tenga una
   marca explicita de borrado. No exige perfil completo, por lo que cuenta
   documentos fantasma e incompletos.
5. No existe enlace `rel=icon`; el navegador solicita `favicon.ico` y recibe
   404 aunque ya hay iconos PNG validos.
6. Permanecen logs temporales de registro, imagen, contador, eliminacion de
   perfil, union a partidas y objetos completos de usuario/credenciales.

## B. Riesgos altos

1. El cliente decide y escribe datos de autoridad: ranking, penalizaciones,
   resultados, valoraciones, mensajes Sistema, notificaciones de terceros y
   mantenimiento automatico de partidas.
2. La eliminacion de perfil modifica documentos ajenos en `usuarios`,
   `partidas`, `historial_partidas`, `notificaciones`, chats y pistas. Una regla
   simple de propietario rompe el borrado; permitirlo a cualquier cliente
   permite modificar datos ajenos.
3. Los mensajes Sistema se crean desde clientes normales. Una regla compatible
   permitiria suplantar al Sistema; una regla segura rompe los avisos actuales.
4. Las notificaciones se crean desde un cliente para otros UIDs. Autorizarlo sin
   backend permite spam y contenido falso; limitar create al destinatario rompe
   partidas y seguimiento.
5. Las imagenes nuevas de pista usan `pistas/{timestamp}.jpg`, sin UID. Storage
   no puede demostrar quien es propietario para permitir un borrado seguro.
6. Mientras quede un solo email antiguo en `usuarios`, las lecturas publicas de
   perfiles siguen exponiendolo. Quitar las escrituras nuevas no migra datos.

## C. Cambios seguros para aplicar ya

1. Dejar de escribir `email` en `usuarios` y eliminar la consulta legacy de
   Chat. Firebase Auth conserva el email necesario para login, reset y
   reautenticacion.
2. Borrar gradualmente el campo email del documento propio al iniciar sesion.
   Antes de publicar sigue siendo obligatoria una migracion Admin de todos los
   documentos antiguos.
3. Exigir perfil completo y no eliminado en el total de usuarios de
   Estadisticas admin.
4. Retirar logs temporales y no imprimir objetos de credenciales, perfiles,
   partidas o errores completos.
5. Enlazar `icon-192-v2.png` como favicon.

## D. Cambios peligrosos que no se aplican

1. No se despliegan reglas: faltan las reglas reales, la configuracion Firebase
   y pruebas con emulador/proyecto.
2. No se cambia el header al resumen hasta que un trigger backend mantenga el
   total en altas y bajas. El resumen actual solo lo mantiene un admin.
3. No se bloquean escrituras ajenas en usuarios, partidas, historial, Sistema o
   notificaciones hasta mover esas mutaciones a Cloud Functions.
4. No se cambia aun la ruta de imagen de pista. Debe coordinarse con Storage
   Rules para usar `pistas/{uid}/foto_{timestamp}.jpg`.
5. No se intenta ocultar email mediante Rules: Firestore autoriza documentos,
   no campos parciales.

## E. Firestore Rules objetivo

Esta es la politica final segura despues de mover a Cloud Functions las
operaciones de autoridad. **No desplegar sobre el cliente actual**: rompería
uniones/salidas complejas, postpartido, avisos Sistema, notificaciones,
anonimizacion y mantenimiento automatico.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function self(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    function myUser() {
      return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data;
    }

    function admin() {
      return signedIn() &&
        (myUser().get('admin', false) == true ||
         myUser().get('rol', '') == 'admin');
    }

    function participant(data) {
      return signedIn() && (
        request.auth.uid in data.get('jugadores', []) ||
        request.auth.uid in data.get('reservas', []) ||
        request.auth.uid == data.get('creadaPor', '') ||
        request.auth.uid == data.get('creador', '')
      );
    }

    function regularMessage() {
      return request.resource.data.u == request.auth.uid &&
        request.resource.data.type == 'text' &&
        request.resource.data.t is string &&
        request.resource.data.t.size() > 0 &&
        request.resource.data.t.size() <= 2000 &&
        request.resource.data.get('system', false) == false;
    }

    match /usuarios/{uid} {
      allow get, list: if signedIn();
      allow create: if self(uid) &&
        request.resource.data.keys().hasOnly([
          'perfilCompleto', 'terminosAceptados', 'terminosAceptadosAt',
          'registroIniciadoAt'
        ]) &&
        !request.resource.data.keys().hasAny(['email', 'admin', 'rol']) &&
        request.resource.data.perfilCompleto == false;
      allow update: if admin() || (self(uid) &&
        !request.resource.data.keys().hasAny(['email']) &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'nombre', 'nombreNormalizado', 'sexo', 'nivel', 'mano', 'posicion',
          'fotoPerfil', 'fotoUrl', 'photoURL', 'perfilCompleto',
          'terminosAceptados', 'terminosAceptadosAt', 'registroIniciadoAt',
          'fechaAlta', 'online', 'lastSeen', 'guiaUsoVista',
          'eliminacionPendienteAuth', 'eliminacionPendienteAt'
        ]));
      allow delete: if self(uid) || admin();

      match /chatLeidos/{chatId} {
        allow read, create, update, delete: if self(uid);
      }
    }

    match /pistas/{pistaId} {
      allow read: if signedIn();
      allow create: if signedIn() &&
        request.resource.data.creadaPor == request.auth.uid &&
        (admin() || request.resource.data.verificada == false);
      allow update, delete: if admin();
    }

    match /partidas/{partidaId} {
      allow read: if signedIn();
      allow create: if signedIn() &&
        request.resource.data.creadaPor == request.auth.uid &&
        request.resource.data.creador == request.auth.uid &&
        request.resource.data.jugadores == [request.auth.uid] &&
        request.resource.data.reservas.size() == 0 &&
        request.resource.data.estado == 'abierta';
      allow update, delete: if admin();

      match /mensajes/{mensajeId} {
        allow read: if participant(
          get(/databases/$(database)/documents/partidas/$(partidaId)).data
        );
        allow create: if participant(
          get(/databases/$(database)/documents/partidas/$(partidaId)).data
        ) && regularMessage();
        allow delete: if admin() ||
          (signedIn() && resource.data.u == request.auth.uid);
        allow update: if false;
      }
    }

    match /chats/general {
      allow read: if signedIn();
      allow create: if signedIn() &&
        request.resource.data.lastSender == request.auth.uid;
      allow update: if signedIn() &&
        request.resource.data.lastSender == request.auth.uid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'lastMessage', 'lastActivity', 'lastSender', 'lastSenderName',
          'lastMessageType'
        ]);
      allow delete: if admin();

      match /mensajes/{mensajeId} {
        allow read: if signedIn();
        allow create: if signedIn() && regularMessage();
        allow delete: if admin() ||
          (signedIn() && resource.data.u == request.auth.uid);
        allow update: if false;
      }
    }

    match /chatsPrivados/{chatId} {
      function member() {
        return signedIn() && request.auth.uid in resource.data.participantes;
      }

      allow read: if member();
      allow create: if signedIn() &&
        request.resource.data.participantes is list &&
        request.resource.data.participantes.size() == 2 &&
        request.auth.uid in request.resource.data.participantes &&
        request.resource.data.participantesMap[request.auth.uid] == true;
      allow update: if member() &&
        request.resource.data.participantes == resource.data.participantes &&
        request.resource.data.participantesMap == resource.data.participantesMap &&
        request.resource.data.lastSender == request.auth.uid;
      allow delete: if admin();

      match /mensajes/{mensajeId} {
        function parent() {
          return get(/databases/$(database)/documents/chatsPrivados/$(chatId)).data;
        }
        allow read: if signedIn() && request.auth.uid in parent().participantes;
        allow create: if signedIn() &&
          request.auth.uid in parent().participantes && regularMessage();
        allow delete: if admin() ||
          (signedIn() && resource.data.u == request.auth.uid);
        allow update: if false;
      }
    }

    match /historial_partidas/{partidaId} {
      allow read: if admin() || participant(resource.data);
      allow create, update, delete: if admin();
    }

    match /notificaciones/{notificacionId} {
      allow read, update, delete: if signedIn() &&
        resource.data.uid == request.auth.uid;
      allow create: if admin();
    }

    match /estadisticas_globales/resumen {
      allow read: if signedIn();
      allow create, update, delete: if admin();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Notas por coleccion:

- `usuarios`: la lectura global es necesaria para Jugadores/Clasificacion. Solo
  es aceptable despues de eliminar todos los emails. Ranking, seguidores y
  penalizaciones quedan fuera del update propio y pasan a backend.
- `pistas`: crear sigue disponible para perfiles autenticados; editar,
  verificar y borrar son admin, igual que la interfaz actual.
- `partidas`: crear sigue en cliente. Todas las mutaciones posteriores deben ser
  funciones transaccionales para impedir cambios arbitrarios.
- mensajes de partida/privados: lectura y texto solo para participantes.
- General: los textos normales siguen en cliente. Sistema y la retencion de
  mensajes pasan a backend/TTL.
- `historial_partidas`: admin o participante lee; solo backend/admin escribe.
- `notificaciones`: el destinatario lee y borra; backend crea.
- `estadisticas_globales/resumen`: todos los autenticados leen y solo backend o
  admin escribe.

## F. Storage Rules

### Variante compatible con las rutas actuales

Esta variante preserva las subidas actuales. Es mejor que reglas abiertas, pero
no es la politica definitiva: cualquier autenticado puede crear objetos nuevos
de pista de hasta 900 KB y un no-admin no puede limpiar un huerfano de pista.

```rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function signedIn() {
      return request.auth != null;
    }

    function admin() {
      return signedIn() && (
        firestore.get(/databases/(default)/documents/usuarios/$(request.auth.uid)).data.get('admin', false) == true ||
        firestore.get(/databases/(default)/documents/usuarios/$(request.auth.uid)).data.get('rol', '') == 'admin'
      );
    }

    function profileImage() {
      return request.resource != null &&
        request.resource.size <= 450 * 1024 &&
        request.resource.contentType == 'image/jpeg';
    }

    function courtImage() {
      return request.resource != null &&
        request.resource.size <= 900 * 1024 &&
        request.resource.contentType == 'image/jpeg';
    }

    match /usuarios/{uid}/{fileName} {
      allow read: if true;
      allow create, update: if signedIn() && request.auth.uid == uid &&
        fileName.matches('foto_[A-Za-z0-9._-]+[.]jpg') && profileImage();
      allow delete: if signedIn() && request.auth.uid == uid;
    }

    match /fotosPerfil/{uid}/{allPaths=**} {
      allow read: if true;
      allow create, update: if signedIn() && request.auth.uid == uid && profileImage();
      allow delete: if signedIn() && request.auth.uid == uid;
    }

    match /fotosPerfil/{fileName} {
      allow read: if true;
      allow create, update: if signedIn() &&
        (fileName == request.auth.uid || fileName.matches(request.auth.uid + '[.].+')) &&
        profileImage();
      allow delete: if signedIn() &&
        (fileName == request.auth.uid || fileName.matches(request.auth.uid + '[.].+'));
    }

    match /pistas/{fileName} {
      allow read: if true;
      allow create: if signedIn() && courtImage();
      allow update, delete: if admin();
    }

    match /imagenesPistas/{allPaths=**} {
      allow read: if true;
      allow create, update: if admin() && courtImage();
      allow delete: if admin();
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Politica definitiva recomendada

Cambiar las dos rutas de `pistas.js` a
`pistas/{auth.uid}/foto_{timestamp}.jpg`. Despues sustituir el match de pistas
por este bloque y conservar un bloque legacy de solo lectura/borrado admin:

```rules
match /pistas/{uid}/{fileName} {
  allow read: if true;
  allow create, update: if signedIn() && request.auth.uid == uid && courtImage();
  allow delete: if admin() || (signedIn() && request.auth.uid == uid);
}

match /pistas/{legacyFileName} {
  allow read: if true;
  allow create, update: if false;
  allow delete: if admin();
}

match /imagenesPistas/{allPaths=**} {
  allow read: if true;
  allow create, update: if false;
  allow delete: if admin();
}
```

## G. Cambios de codigo minimos y backend requerido

Cambios locales seguros:

- retirar email de los dos payloads de perfil;
- borrar el email propio antiguo al iniciar sesion;
- retirar la busqueda Chat por email;
- corregir el filtro de usuarios admin;
- retirar logs temporales y enlazar favicon;
- incrementar versiones JS/PWA/cache.

Trabajo backend requerido antes de reglas finales:

1. Trigger de Auth/Firestore para mantener `estadisticas_globales/resumen` en
   altas completas y bajas, de forma idempotente.
2. Funciones transaccionales para unirse, salir, confirmar, sustituir,
   resultados, valoraciones, ranking y penalizaciones.
3. Funcion para crear mensajes Sistema y notificaciones de terceros.
4. Funcion de eliminacion/anonimizacion de cuenta con Admin SDK.
5. Migracion Admin que borre `email` de todos los `usuarios` existentes.
6. Ruta de pista con UID y despliegue coordinado de Storage Rules.

## H. Cambios aplicados en esta auditoria

- `app.js`: ya no escribe email, retira el email legacy propio al iniciar sesion
  y elimina trazas temporales de imagen, registro, contador y navegacion.
- `chat.js` y `perfil.js`: eliminan la busqueda/fallback por email y trazas con
  objetos completos.
- `estadisticas.js`: solo cuenta perfiles completos, incluidos perfiles legacy
  realmente completos, y excluye las marcas de eliminado/inactivo.
- `index.html`: enlaza el icono PNG existente como favicon.
- Versiones: `app.js?v=33`, `perfil.js?v=42`, `pistas.js?v=19`,
  `chat.js?v=24`, `partidas.js?v=37`, `estadisticas.js?v=7`, `pwa.js?v=72`,
  PWA/cache `v113`.
- Verificacion automatica: `node --check` correcto en todos los JavaScript.
- No se pudieron compilar Rules: Firebase CLI no esta instalado y no hay
  configuracion Firebase en el workspace.

## Matriz manual obligatoria

1. Registro y cancelacion de registro incompleto.
2. Editar perfil.
3. Cambiar y eliminar foto.
4. Eliminar perfil.
5. Crear pista con imagen y editarla como admin.
6. Crear partida.
7. Unirse, salir y sustituciones.
8. Chat general.
9. Chat privado entre participantes.
10. Chat de partida solo para jugadores/reservas.
11. Crear, recibir y marcar notificaciones propias.
12. Recalcular contador admin y comprobar alta/baja posterior.
13. Estadisticas admin sin documentos incompletos/eliminados.
14. PC, movil y PWA instalada, incluyendo actualizacion de cache.
