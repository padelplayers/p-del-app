# Auditoria y versionado de reglas Firebase

Fecha: 2026-06-21

## Estado de origen

El proyecto no contenia `firestore.rules`, `storage.rules`, `firebase.json` ni
`.firebaserc`. Firebase CLI tampoco tenia una sesion autenticada y la API key
web de `index.html` no permite descargar Security Rules. Por ello:

- `firestore.rules` **no puede certificarse como copia de las reglas publicadas**;
- `storage.rules` es una propuesta compatible con las rutas observadas;
- ambas deben compararse con Firebase Console antes de cualquier despliegue;
- no se ha desplegado ni modificado ninguna regla remota.

## Archivos versionados

- `firestore.rules`: base compatible propuesta, con cierre global.
- `storage.rules`: propuesta para imagenes actuales y legacy.
- `firebase.json`: referencia exclusivamente esos dos archivos de reglas.

No se ha tocado JavaScript ni logica de negocio durante esta tarea.

## Clasificacion Firestore

| Coleccion/ruta | Clase | Regla versionada | Motivo y riesgo |
|---|---|---|---|
| `usuarios` | B/C/D | Lectura autenticada. Create/delete propio. Update propio o update cruzado limitado. `admin` y `rol` son inmutables. | Propietario estricto rompe seguimiento, ranking, penalizaciones, postpartido y borrado de perfil. El update cruzado sigue siendo autoridad manipulable desde cliente. |
| `usuarios/{uid}/chatLeidos` | A | Solo propietario. | Todas las lecturas, escrituras y borrados observados usan el UID autenticado. |
| `pistas` | A/B | Lectura autenticada; create del creador; edicion/borrado admin. El creador solo puede anonimizar campos de autoria. | Conserva crear pista, edicion admin y eliminacion de perfil. |
| `partidas` | B/C/D | Lectura autenticada; create ligado al creador; update/delete autenticado temporal. | Unirse, salir, sustituciones, limpieza, resultado y postpartido se ejecutan en clientes. Sigue siendo el principal riesgo residual. |
| `partidas/{id}/mensajes` | A | Solo jugadores/reservas; create exige `u == auth.uid` cuando existe; delete para participantes. | El delete de participante conserva limpieza de chats y perfil. No se permite update. |
| `chats/general` | B/C | Autenticados pueden mantener metadatos. | Los avisos Sistema siguen naciendo en cliente. |
| `chats/general/mensajes` | B/C/D | Lectura autenticada; texto exige autor; Sistema y limpieza siguen funcionales. | Un autenticado aun puede crear/suprimir mensajes Sistema. Debe pasar a backend. |
| `chatsPrivados` | A | Solo participantes leen, actualizan o borran; create exige dos participantes y mapa coherente. | Admite inicializacion de documentos legacy sin array de participantes. |
| `chatsPrivados/{id}/mensajes` | A | Solo participantes; autor validado en create; participante puede borrar. | Borrado amplio necesario para retencion y eliminar perfil. |
| `historial_partidas` | B/C/D | Autenticados temporalmente. | Estadisticas admin, cierre y anonimizacion estan acoplados al cliente. Puede falsificarse historial. |
| `notificaciones` | B/C/D | Autenticados temporalmente. | El cliente crea avisos para terceros, consulta por partida sin UID y anonimiza avisos ajenos. Riesgo de lectura/spam/manipulacion. |
| cualquier otra ruta | A | Denegada. | Evita colecciones accidentales no inventariadas. |

Clases:

- A: puede cerrarse ahora sin romper los flujos observados.
- B: conviene dejar funcional temporalmente.
- C: requiere Cloud Functions o cambios grandes.
- D: riesgo alto si se publica con autoridad de cliente.

## Cierres seguros incluidos

1. Ningun cliente puede crear o modificar `admin` o `rol` mediante
   `usuarios/{uid}`.
2. `chatLeidos` queda completamente limitado a su propietario.
3. Documentos y mensajes privados solo son accesibles para participantes.
4. Mensajes de partida solo son accesibles para jugadores o reservas.
5. En create, el autor `u` de mensajes privados/de partida debe coincidir con
   `request.auth.uid` cuando el campo existe.
6. Las pistas verificadas y su edicion/borrado quedan bajo admin, salvo la
   anonimizacion minima del creador al eliminar su perfil.
7. Todo lo no definido queda denegado.

## Storage propuesto

Rutas actuales verificadas:

- perfil nuevo: `usuarios/{uid}/foto_{timestamp}.jpg`;
- perfil legacy: `fotosPerfil/{uid}/...`, `fotosPerfil/{uid}` o
  `fotosPerfil/{uid}.extension`;
- pista actual: `pistas/{timestamp}.jpg`;
- pista legacy: `imagenesPistas/...`.

Politica:

- lectura publica para las cuatro familias de imagenes;
- perfil: create/update/delete solo del UID propietario;
- perfil: maximo 450 KB y `image/jpeg`;
- pista: maximo 900 KB y `image/jpeg`;
- pista actual: cualquier autenticado puede crear, pero solo admin puede
  sobrescribir o borrar;
- pista legacy: solo admin escribe o borra;
- resto de Storage denegado.

La app acepta imagenes de entrada variadas, pero las convierte en JPEG antes de
subir. No necesita autorizar nuevos PNG. Los PNG legacy siguen siendo legibles y
borrables por quien corresponda, porque MIME/tamano solo se validan en
create/update.

### Limite de la ruta de pistas

`pistas/{timestamp}.jpg` no contiene UID ni ID de documento. Storage Rules no
puede demostrar quien la subio. Para impedir tambien creaciones abusivas y
permitir al creador limpiar un huerfano hace falta migrar coordinadamente a
`pistas/{uid}/foto_{timestamp}.jpg`. No se hizo porque cambiaria JS y reglas a la
vez.

## Cloud Functions necesarias

1. Operaciones transaccionales de partida: unirse, salir, sustituciones,
   confirmar, cancelar y limpieza temporal.
2. Resultado, validaciones, valoraciones, ranking, nivel y penalizaciones.
3. Creacion/resolucion de mensajes Sistema.
4. Creacion de notificaciones para terceros y limpieza por caducidad.
5. Cierre de partida y escritura inmutable de `historial_partidas`.
6. Eliminacion/anonimizacion completa de perfil con Admin SDK.

Tras mover esos bloques, deben retirarse los permisos temporales de update/delete
en `partidas`, escritura Sistema, `historial_partidas`, `notificaciones` y los
updates cruzados de `usuarios`.

## Verificacion realizada

- Inventario estatico de todas las llamadas `collection(...)` del cliente.
- Revision de flujos de registro, foto, pistas, partidas, chats, postpartido,
  notificaciones, estadisticas y eliminacion de perfil.
- `firebase.json` parseado correctamente como JSON.
- Firebase CLI 15.22.0 disponible temporalmente.
- No fue posible compilar/probar Rules: no hay credenciales Firebase y Java no
  esta instalado para Firestore Emulator. El dry-run se detuvo antes de compilar
  por falta de autenticacion. No se realizo despliegue.

## Pruebas manuales obligatorias antes de publicar

Realizarlas primero con Emulator Suite o un proyecto de staging y dos usuarios
normales mas un admin:

1. Registro, completar perfil y editar perfil.
2. Cambiar y eliminar foto; comprobar que un segundo usuario no puede borrarla.
3. Cancelar registro incompleto y eliminar un perfil completo.
4. Crear pista con imagen como usuario; editar/verificar/borrar como admin.
5. Crear, unirse, salir, confirmar y gestionar sustituciones de una partida.
6. Chat general y avisos Sistema.
7. Chat privado: ambos participantes acceden; un tercero recibe
   `permission-denied` en documento, listener y mensajes.
8. Chat de partida: jugador/reserva accede; un tercero recibe
   `permission-denied`.
9. Notificaciones: crear para terceros, recibir, borrar y limpiar por partida.
10. Resultado, validacion, rechazo y valoraciones.
11. Ranking, nivel, penalizaciones y restricciones.
12. Cierre y escritura de historial.
13. Estadisticas admin, incluido total y distribucion por sexo.
14. Intentar modificar `admin` y `rol` desde un usuario normal: debe fallar.
15. Intentar leer/escribir una coleccion no declarada: debe fallar.

## Secuencia de publicacion

1. Copiar desde Firebase Console las reglas Firestore/Storage actualmente
   desplegadas y compararlas linea a linea con estos archivos.
2. Compilar y ejecutar pruebas de reglas en Emulator Suite.
3. Publicar primero en staging y completar las 15 pruebas.
4. Solo despues desplegar reglas a produccion.
