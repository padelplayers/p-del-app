# Matriz de operaciones Firebase basada en codigo real

Fecha: 2026-06-22

Esta matriz contrasta el codigo actual con `firestore.rules` y
`storage.rules` del proyecto. Las lineas son aproximadas y corresponden al
estado auditado. `SI-T` significa permitido por una excepcion temporal con
riesgo residual. No se desplego ninguna regla.

## app.js

| Archivo | Funcion / linea | Ruta | Operacion | Ejecutor | Campos | Propio/ajeno | Regla actual | Riesgo |
|---|---|---|---|---|---|---|---|---|
| app.js | auditarRegistrosIncompletosAdmin ~13 | usuarios | get propio + list | admin UI | lectura de perfilCompleto/fechas | ambos | read signedIn: SI | Lista visible a cualquier autenticado |
| app.js | subirImagen ~176 | Storage usuarios o pistas | upload | propietario/admin/usuario creador | JPEG optimizado | propio o ruta pista | reglas por ruta: SI | Pista sin UID |
| app.js | borrarImagenStorageSiProcede ~253 | Storage rutas permitidas | deleteObject | propietario/admin | objeto de imagen | propio/pista | owner perfil o admin pista: SI | Creador normal no limpia pista huerfana |
| app.js | listeners auth ~399/~793 | usuarios/{uid} | get | usuario propio | perfil completo/admin | propio | read signedIn: SI | Bajo |
| app.js | actualizarPresenciaUsuario ~430 | usuarios/{uid} | get + update | usuario propio | online,lastSeen | propio | owner + validPresenceState: SI | Presencia cliente |
| app.js | registro ~548 | usuarios/{uid} | set merge/create | usuario propio | perfilCompleto=false, terminos, timestamps | propio | validIncompleteUserCreate: SI | Cerrado |
| app.js | guardarPerfilRegistroInterno ~590 | usuarios | query nombre | usuario incompleto | nombreNormalizado | ajenos lectura | read signedIn: SI | Expone perfiles autenticados |
| app.js | guardarPerfilRegistroInterno ~621 | usuarios/{uid} | get + set merge | usuario propio | nombre,sexo,nivel,mano,posicion,foto,perfilCompleto,admin=false,online,lastSeen,arrays | propio | owner update o validCompleteUserCreate: SI | Create completo solo con campos obligatorios |
| app.js | ejecutarTareasAuxiliaresRegistro ~686 | usuarios/{uid}/chatLeidos/general | set merge | usuario propio | lastReadAt,updatedAt,tipo,titulo | propio | isOwner: SI | Bajo |
| app.js | mostrarPantallaInicialUsuario ~735 | usuarios/{uid} | set merge | usuario propio | guiaUsoVista | propio | owner update: SI | Bajo |
| app.js | listener auth ~800 | usuarios/{uid} | update/set merge | usuario propio | delete email; perfilCompleto=true legacy | propio | owner, sin email final: SI | Migra legado |
| app.js | eliminarFotoPerfil ~900 | usuarios/{uid} + Storage | get/update/deleteObject | usuario propio | fotoPerfil default, delete fotoUrl/photoURL | propio | owner + Storage owner: SI | Bajo |
| app.js | cambio de foto ~950 | Storage usuarios/{uid} + usuario | upload/update/deleteObject | usuario propio | fotoPerfil | propio | owner: SI | Bajo |
| app.js | cargarClasificacionComunitaria ~1247 | usuarios | list + updates | cualquier autenticado | clasificacion.penalizacionesActivas/fiabilidad | ajenos | compatibleCrossUserUpdate: SI-T | Cualquiera puede alterar clasificacion completa |

## perfil.js

| Archivo | Funcion / linea | Ruta | Operacion | Ejecutor | Campos | Propio/ajeno | Regla actual | Riesgo |
|---|---|---|---|---|---|---|---|---|
| perfil.js | cargarUsuariosSocialesPerfil/abrirPerfilSocial ~900 | usuarios/{uid} | get | autenticado | perfil | ajeno | read signedIn: SI | Lectura global necesaria |
| perfil.js | resolverPartidasActivasAntesDeEliminarPerfil ~1048 | partidas | queries + transactions externas | usuario que elimina perfil | jugadores,reservas y salida | ambas | update signedIn: SI-T | Maquina de estados cliente |
| perfil.js | eliminarMensajesGeneralUsuarioPerfil ~1131 | chats/general/mensajes | query + batch delete + set metadata | autor que elimina perfil | mensajes u==uid; lastMessage/* | ajeno parent/propios mensajes | general delete/metadata: SI-T | Borrado general amplio |
| perfil.js | eliminarChatsPrivadosUsuarioPerfil ~1179 | chatsPrivados y mensajes | 2 queries + batch delete + parent delete | participante | mensajes y chat completos | compartido | participant: SI | Tercero denegado |
| perfil.js | eliminarMensajesPartidasUsuarioPerfil ~1227 | partidas/{id}/mensajes | query + batch delete + parent metadata | autor/participante o ex participante | mensajes u==uid; lastMessage/* | propios mensajes/shared parent | participant OR author: SI | Ajustado para carrera de salida |
| perfil.js | limpiarRelacionesSocialesUsuario ~1293 | usuarios | list + batch update | usuario que elimina perfil | seguidores,siguiendo,seguidos,clasificacion.*Map | ajenos | compatibleCrossUserUpdate: SI-T | Update cruzado |
| perfil.js | anonimizarPistasCreadasUsuario ~1358 | pistas | queries + batch update | creador antes de borrar cuenta | campos de creador/nombre | ajenos compartidos | creator limited update: SI | Cerrado a esos campos |
| perfil.js | anonimizarHistorialUsuarioEliminado ~1593 | historial_partidas | muchas queries + batch update | usuario que elimina perfil | UIDs/nombres anidados, resultado,valoraciones | ajenos/shared | historial signedIn: SI-T | Historial modificable por clientes |
| perfil.js | anonimizarPartidasVivasUsuarioEliminado ~1670 | partidas | list + batch update | usuario que elimina perfil | identidad en arrays/mapas/resultado | ajenos/shared | update signedIn: SI-T | Partidas abiertas |
| perfil.js | limpiarNotificacionesUsuarioEliminado ~1873 | notificaciones | queries + batch delete/set merge | usuario que elimina perfil | uid/uids/nombres/data/mensaje/cantidad | propias y ajenas | notif signedIn: SI-T | Coleccion ampliamente mutable |
| perfil.js | borrarSubcoleccionesUsuario ~1996 | usuarios/{uid}/chatLeidos | list + batch delete | propietario | documentos lectura | propio | isOwner: SI | Bajo |
| perfil.js | eliminarStorageUsuario ~2008 | Storage usuarios/fotosPerfil legacy | list/get/deleteObject | propietario | objetos de perfil | propio | owner: SI | Bajo |
| perfil.js | borrarUsuarioFirestoreYAuthPerfil ~2188 | usuarios/{uid} | delete; create recuperacion | propietario | perfilCompleto=false,eliminacionPendiente* | propio | delete owner + incomplete create: SI | Recuperacion compatible |
| perfil.js | cancelarRegistroIncompleto ~2219 | usuarios,notificaciones,Storage | get/query/delete | propietario | documento incompleto y avisos propios | propio | SI | Bajo |
| perfil.js | verPerfil/cargarPerfil ~2372/~2619 | usuarios | get/listener/query | autenticado | perfiles completos | propio/ajeno | read signedIn: SI | Necesario |
| perfil.js | toggleSeguir ~2506 | usuarios/{miUid}/{otroUid} | 2 updates | usuario autenticado | siguiendo,seguidores | propio y ajeno | cross allowlist: SI-T | Cliente altera arrays ajenos |
| perfil.js | guardarPerfil ~2588 | usuarios/{uid} | update | propietario | mano,posicion | propio | owner: SI | Bajo |

## pistas.js

| Archivo | Funcion / linea | Ruta | Operacion | Ejecutor | Campos | Propio/ajeno | Regla actual | Riesgo |
|---|---|---|---|---|---|---|---|---|
| pistas.js | incrementar/recalcularPistasCreadas ~34 | usuarios/{uid} | set merge | propietario | clasificacion.pistasCreadas | propio | owner: SI | Bajo |
| pistas.js | guardarPista handler ~80 | pistas | list + add | usuario completo | datos pista,creadaPor,imagen,verificada | nuevo | create creator+image: SI | Reglas no validan todos los valores |
| pistas.js | guardarPista handler ~186 | Storage pistas/{timestamp}.jpg | upload | autenticado | JPEG <=900 KiB | ruta sin propietario | create signedIn: SI-T | No hay UID |
| pistas.js | cargarPistas ~290 | usuarios/pistas | get + query listener | autenticado | lectura | ambos | read signedIn: SI | Bajo |
| pistas.js | verificarPista ~519 | pistas/{id} | update | admin | verificada,verificadaPor,fechaVerificada | ajeno/shared | isAdmin: SI | Cerrado |
| pistas.js | eliminarPista ~535 | pistas + Storage | get/delete/deleteObject | admin | documento y sus imagenes | ajeno/shared | isAdmin: SI | Cerrado |
| pistas.js | actualizar pista ~588 | pistas + Storage | get/upload/update/deleteObject | admin | datos pista,verificada,imagen,delete imagenUrl | ajeno/shared | isAdmin: SI | Cerrado |
| pistas.js | catch create ~203 | Storage pistas/{timestamp}.jpg | deleteObject | creador no admin | imagen recien subida | propio no demostrable | BLOQUEADO deliberadamente | Puede quedar objeto huerfano |

## partidas.js

| Archivo | Funcion / linea | Ruta | Operacion | Ejecutor | Campos | Propio/ajeno | Regla actual | Riesgo |
|---|---|---|---|---|---|---|---|---|
| partidas.js | asegurarRestriccionFiabilidadUsuario ~252 | usuarios/{uid} + notificaciones | get/set merge/create aviso | propio usuario | restriccionFiabilidad | propio/aviso propio | owner/notif: SI | Avisos abiertos |
| partidas.js | crearPartida ~1290 | partidas | add | creador completo | pista,fecha,hora,tipo,genero,nivel,jugadores=[uid],reservas=[],estado,creador | nuevo | strict create: SI | Cerrado en create |
| partidas.js | crearPartida ~1357 | usuarios/{uid} | set merge | creador | clasificacion.partidasCreadas | propio | owner: SI | Bajo |
| partidas.js | recalcularPartidasCreadas ~1376 | partidas/historial/usuario | queries + set merge | propietario | clasificacion.partidasCreadas | propio | read broad + owner: SI | Bajo |
| partidas.js | confirmarPartida ~1449 | partidas/{id} | transaction update | creador | estado,confirmadaAt,confirmadaPor | shared | update signedIn: SI-T | Regla no valida creador |
| partidas.js | eliminarPartidaConChat ~1429 | partidas/{id} | delete | creador/flujo cleanup | documento | shared | delete signedIn: SI-T | Cualquier autenticado podria borrar |
| partidas.js | procesarLimiteCancelacionClub ~2036 | partidas + usuarios | transaction delete/update | cualquier cliente autenticado | cancelacion/penalizaciones/clasificacion | ajeno | partidas broad + cross usuarios: SI-T | Alto |
| partidas.js | revisar/cargar partidas ~2200 | partidas | list | autenticado | lectura | ajeno | read signedIn: SI | Necesario |
| partidas.js | ejecutarUnirseAPartidaTransaccional ~2670 | partidas + usuarios | get + transaction update | jugador/reserva | jugadores,reservas,sustitucion,estado,incompleta* | shared | update signedIn: SI-T | Autoridad cliente |
| partidas.js | solicitarSustitutoPartida ~2950 | partidas | transaction update | participante | solicitudSustitucion*,sustitucion* | shared | update signedIn: SI-T | Alto |
| partidas.js | ejecutarSalirDePartidaTransaccional ~3140 | partidas + usuarios | update/transaction | jugador/reserva/creador | jugadores,reservas,estado,cambioCreador,sustitucion,abandono | shared | update signedIn: SI-T | Alto |
| partidas.js | finalizarSalidaPartida ~3200 | usuarios/{uid} | transaction update | participante que sale | clasificacion,penalizaciones,restriccion* | propio/puede ser ajeno en limpieza | cross allowlist: SI-T | Alto |
| partidas.js | aceptarCambioCreadorPartida ~3440 | partidas | transaction update | nuevo creador | creadaPor,creador,cambioCreador* | shared | update signedIn: SI-T | Alto |
| partidas.js | aceptar/rechazarSustitucion ~3530/~3725 | partidas | transactions update | reserva | jugadores,reservas,sustitucion*,solicitud* | shared | update signedIn: SI-T | Alto |
| partidas.js | unirseAPartida legacy ~3900 | partidas | get/update | autenticado | jugadores/reservas | shared | update signedIn: SI-T | Camino legacy amplio |
| partidas.js | guardarPartidaFinalizada ~4088 | historial_partidas + partida | get/create/set merge | participante/cierre cliente | resumen completo; guardadaEnHistorial* | shared | historial/partida signedIn: SI-T | Historial falsificable |

## postpartido.js y nivel.js

| Archivo | Funcion / linea | Ruta | Operacion | Ejecutor | Campos | Propio/ajeno | Regla actual | Riesgo |
|---|---|---|---|---|---|---|---|---|
| postpartido.js | aplicarClasificacionComunitariaAmistosa ~510 | usuarios/partida/pista | transaction get/update | participante | clasificacion completa,stats aplicada | 4 usuarios ajenos/shared | cross usuarios + partida broad: SI-T | Alto |
| postpartido.js | aplicarClasificacionComunitariaRanking ~627 | usuarios/partida/pista | transaction get/update | participante | puntos,partidos,victorias,mapas,flags | 4 usuarios ajenos/shared | SI-T | Alto |
| postpartido.js | registrarNoPresentado ~799 | partida + usuario infractor | transaction update | participante | incidencia,resultado/valoraciones delete,penalizaciones,clasificacion | ajeno/shared | SI-T | Alto |
| postpartido.js | generar/aplicar avisos ~945/~1020 | partidas + usuarios | query/transactions | cualquier cliente que revisa | avisos/incumplimientos/restricciones | ajeno | SI-T | Alto |
| postpartido.js | finalizarPartidaRankingSiCompleta ~1165 | partidas | transaction update | participante | estado/finalizadaAt/flags | shared | SI-T | Alto |
| postpartido.js | guardarResultadoPropuesto ~1808 | partidas | update | participante | resultado completo | shared | SI-T | Alto |
| postpartido.js | guardarValoracionesAmistosa ~2235 | partidas | set merge/update | participante | valoraciones,participantesPostPartido,estado | shared | SI-T | Alto |
| postpartido.js | selector participantes ~2393/~2471/~2523 | partidas | set merge | participante | participantesPostPartido | shared | SI-T | Alto |
| postpartido.js | confirmar/rechazarResultado ~2738/~2817 | partidas | transaction update | participante | resultado.validaciones/rechazos/estado | shared | SI-T | Alto |
| nivel.js | aplicarRankingCompetitivo ~83 | usuarios + partida | transaction set merge/update | participante que cierra | nivel,nivelInicial,nivelDelta,rankingPartidos,clasificacion.victoriasRanking,flag | 4 usuarios ajenos/shared | cross allowlist + partida broad: SI-T | Alto |

## notifications.js

| Archivo | Funcion / linea | Ruta | Operacion | Ejecutor | Campos | Propio/ajeno | Regla actual | Riesgo |
|---|---|---|---|---|---|---|---|---|
| notifications.js | crearNotificacionInterna ~38 | notificaciones/{id} | add/set merge | cualquier cliente | uid,tipo,titulo,mensaje,partidaId,estado,data | normalmente tercero | create signedIn + uid: SI-T | Spam/manipulacion |
| notifications.js | crearOActualizar...Agrupada ~98 | notificaciones/{id} | transaction set merge | seguidor/flujo baja | uid,paraUid,cantidad,uids,nombres,data | tercero | notif update/create: SI-T | Alto |
| notifications.js | borrarNotificacionPropiaPorRef ~204 | notificaciones/{id} | get/delete | destinatario | documento | propio | broad signedIn: SI-T | Regla no fuerza propiedad |
| notifications.js | resolver...PorPartidaId ~227 | notificaciones | query + batch delete | participante/destinatario | documentos filtrados cliente | propios tras leer ajenos | broad read/delete: SI-T | Query no es filtro de seguridad |
| notifications.js | limpiarNotificacionesAntiguas ~258 | notificaciones | query + batch delete | destinatario | caducadas/resueltas | propio | SI-T | Bajo funcional, regla amplia |
| notifications.js | mostrarPopupNotificacion ~462 | notificaciones/{id} | set merge | destinatario | popupMostrado | propio | update signedIn: SI-T | Amplio |
| notifications.js | escuchar/marcar todas ~508/~593 | notificaciones | listener/query/batch delete | destinatario | lectura/borrado | propio | SI-T | Necesario |
| notifications.js | limpiarNotificacionesAntiguasAdmin ~617 | notificaciones | list + batch delete | admin | docs leidos/resueltos | ajenos | SI-T | Regla no comprueba admin |

## chat.js

| Archivo | Funcion / linea | Ruta | Operacion | Ejecutor | Campos | Propio/ajeno | Regla actual | Riesgo |
|---|---|---|---|---|---|---|---|---|
| chat.js | asegurarDocumentoChatPrivado ~361 | chatsPrivados/{id} | set merge/create/update | participante | participantes,participantesMap,actualizadoAt | compartido | exact 2 participants: SI | Cerrado |
| chat.js | crearOMantenerMensajeSistemaGeneral ~433 | chats/general + mensajes | transaction set/update | usuario completo | mensaje system y metadata | compartido | validSystemMessage/metadata: SI-T | Cualquier completo puede simular Sistema |
| chat.js | resolver mensajes Sistema ~502/~517 | chats/general/mensajes | get/query/batch delete | usuario completo | mensajes system | ajeno/shared | general delete: SI-T | Borrado amplio |
| chat.js | cargarUsuariosSidebar ~693 | usuarios | query online | usuario completo | lectura perfil/presencia | ajeno | read signedIn: SI | Necesario |
| chat.js | eliminarChatTotal ~997 | partidas/mensajes | query/batch delete/update parent | participante que cierra | mensajes; delete lastMessage/* | shared | participant delete + partida broad: SI-T | Alto |
| chat.js | limpiarMensajesAntiguos ~1053 | general/privado mensajes | query + batch delete | participante/usuario completo | mensajes antiguos/exceso | ajenos/shared | general broad o private participant: SI-T | Retencion cliente |
| chat.js | prepararEnvioChat general ~1130 | chats/general/mensajes + parent | batch set | usuario completo | u,n,t,at,type + metadata | propio/shared | user message + metadata: SI | Cerrado por forma |
| chat.js | prepararEnvioChat partida ~1174 | partidas/{id}/mensajes + parent | batch set/update | participante/reserva | mensaje + lastMessage/* | shared | participant + partida broad: SI-T | Parent amplio |
| chat.js | prepararEnvioChat privado ~1184 | chatsPrivados/{id}/mensajes + parent | batch set/merge | participante | mensaje,participantes,map,metadata | shared | participant/exact map: SI | Tercero denegado |
| chat.js | marcas de lectura ~1250/~1490 | usuarios/{uid}/chatLeidos/{id} | get/set merge | propietario | lastReadAt,updatedAt,tipo,titulo | propio | isOwner: SI | Bajo |
| chat.js | listeners resumen ~1359/~1430/~1472 | general/partidas/privados | listeners/query | usuario completo/participante | lectura metadata | shared | reglas respectivas: SI | Privado query acotado por map |
| chat.js | abrirChatPartida ~1660 | partidas/{id} | get | autenticado | partida | shared | read signedIn: SI | Parent visible a autenticados |

## jugadores.js, estadisticas.js y pwa.js

| Archivo | Funcion / linea | Ruta | Operacion | Ejecutor | Campos | Propio/ajeno | Regla actual | Riesgo |
|---|---|---|---|---|---|---|---|---|
| jugadores.js | cargarJugadores ~132 | usuarios | list | autenticado | perfiles completos | ajeno | read signedIn: SI | Lectura global |
| estadisticas.js | cargarUsuario/usuarios ~240/~250 | usuarios | get/list | admin UI | perfiles/clasificacion | ajeno | read signedIn: SI | Regla no fuerza admin |
| estadisticas.js | cargarPista ~395 | pistas/{id} | get | admin UI | pista | ajeno | read signedIn: SI | Bajo |
| estadisticas.js | cargarHistorial ~410 | historial_partidas | list | admin UI | historial completo | ajeno | historial signedIn: SI-T | Todos autenticados podrian listar |
| estadisticas.js | resincronizarAvisosSistemaAdmin ~680 | partidas | list; llama generadores Sistema | admin | lectura y avisos | ajeno | signedIn/Sistema: SI-T | Admin solo en UI, no en regla |
| pwa.js | init/actualizacion | service-worker/cache | registro/update SW | navegador | sin Firestore/Storage | n/a | n/a | Solo entrega de versiones |

## Bloqueos detectados y decision

| Bloqueo | Flujo | Causa | Ajuste |
|---|---|---|---|
| Create completo convertido desde set merge | completar perfil si falta doc incompleto | create anterior solo aceptaba perfilCompleto=false | validCompleteUserCreate con cinco campos obligatorios |
| Pista sin foto llegaba a Firestore | crear pista obligatoria | UI no detenía archivo ausente y regla exige imagen | validacion pequena en pistas.js ya aplicada |
| estadisticas_globales cerrada | compatibilidad con ruta publicada/legacy | match omitido | match resumen restaurado para read signedIn/write admin |
| Carrera al borrar mensajes de partida | eliminar perfil completo | salida y borrado mensajes corren paralelos | read/delete permitido a participante o autor del mensaje |
| Metadatos de chat demasiado abiertos | chat general/privado | parent admitia campos arbitrarios | allowlist de campos create/update |
| Limpieza de imagen huerfana de pista | fallo Firestore tras upload | ruta pistas/{timestamp}.jpg no demuestra creador | No abrir delete; migrar a pistas/{uid}/{archivo} |

No se detecta otro bloqueo determinista entre el codigo actual y las reglas
ajustadas. La limpieza del objeto huerfano es el unico caso funcional residual:
no impide una creacion correcta, pero puede dejar Storage sin limpiar cuando la
creacion Firestore falla.

## Permisos abiertos temporales exactos

| Ruta | Regla temporal | Funciones que la necesitan | Riesgo | Solucion futura |
|---|---|---|---|---|
| partidas/{id} | update/delete signedIn | unirse/salir, sustituciones, confirmar, limpiezas, postpartido | cualquier cliente puede alterar/borrar | Cloud Functions transaccionales |
| usuarios/{otroUid} | allowlist top-level cruzada | toggleSeguir, clasificacion, ranking, penalizaciones, baja | clasificacion completa manipulable | Functions para social/ranking/sanciones |
| historial_partidas/{id} | CRUD signedIn | guardarPartidaFinalizada, estadisticas, anonimizarHistorial | falsificacion/borrado | cierre inmutable backend |
| notificaciones/{id} | read/update/delete signedIn; create con uid | avisos terceros, agrupacion, query por partida, limpieza | lectura/spam/manipulacion | backend + queries solo destinatario |
| chats/general/mensajes | Sistema y delete por completo | crearOMantener..., retencion, baja | suplantacion Sistema/borrado | Functions/TTL |
| Storage pistas/{timestamp}.jpg | create signedIn; delete admin | crear/editar pista actual | abuso de uploads, sin propiedad | pistas/{uid}/{archivo} |

## Reglas completas listas para copiar

- Firestore: `firestore.rules` es el bloque completo ajustado.
- Storage: `storage.rules` es el bloque completo ajustado.

No hay fragmentos adicionales ni reglas implicitas fuera de esos archivos.
`firebase.json` referencia exactamente ambos.

## Pruebas minimas de permisos

1. Registro incompleto, completar perfil con documento existente y completar
   perfil tras borrar ese documento; intento fantasma con solo online/lastSeen.
2. Presencia de dos perfiles completos y rechazo de admin/rol/email.
3. Foto perfil: upload, reemplazo, delete propio y delete ajeno denegado.
4. Pista: crear con JPEG, rechazo sin foto, admin edita/reemplaza/verifica/borra.
5. Partida: crear, unirse, reserva, aceptar sustitucion, salir y confirmar.
6. Chat general texto+Sistema+retencion; chat privado A/B con tercero denegado;
   chat partida con no participante denegado.
7. Resultado ranking: proponer, validar/rechazar, valorar y comprobar los cuatro
   usuarios y flags de partida.
8. Notificacion a tercero, agrupada, query por partida, accion y limpieza admin.
9. Eliminar perfil con partida activa no creador, mensajes, seguidores,
   notificaciones, historial y foto; comprobar anonimización.
10. Estadisticas admin, jugadores y clasificacion; coleccion desconocida
    denegada.

## Veredicto

**Publicable con riesgo residual**, solo despues de compilar Rules y ejecutar
estas diez pruebas en staging. No es seguridad definitiva mientras partidas,
clasificacion cruzada, historial, notificaciones y Sistema sigan en clientes.
No se recomienda produccion directa sin esa validacion.

