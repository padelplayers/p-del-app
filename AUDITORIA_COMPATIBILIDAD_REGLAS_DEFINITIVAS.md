# Auditoria de compatibilidad de reglas definitivas

Fecha: 2026-06-22

## Alcance y limites

Se revisaron `app.js`, `perfil.js`, `pistas.js`, `partidas.js`,
`postpartido.js`, `nivel.js`, `notifications.js`, `chat.js`,
`jugadores.js` y `estadisticas.js`.

La comparacion Firestore usa las reglas publicadas copiadas por el propietario
del proyecto. No se facilitaron las reglas Storage publicadas: Storage solo puede
compararse con la propuesta local y con las rutas reales del codigo.

No se desplego ninguna regla. No se modificaron calculos, consultas, listeners,
transacciones ni logica de negocio. El unico ajuste JavaScript es una validacion
previa de la foto obligatoria de pista, necesaria para que el rechazo de la regla
no termine como un `permission-denied` opaco.

## Diagnostico

Las reglas Firestore publicadas mantienen casi toda la aplicacion operativa, pero
permiten que cualquier autenticado edite o borre pistas, partidas, historial,
notificaciones y el chat general. Tambien permiten listar metadatos de todos los
chats privados.

La propuesta anterior cierra de forma segura privilegios, pistas, chats privados,
chat de partida y rutas desconocidas. Tenia tres incompatibilidades:

1. Solo permitia crear `usuarios/{uid}` incompletos. Un `set(..., merge:true)`
   de perfil completo se convierte en create si el documento inicial falta.
2. Omitia `estadisticas_globales/resumen`, que quedaba cerrado por el fallback.
3. Firestore no exigia la imagen de pista aunque el requisito funcional dice que
   es obligatoria.

Las reglas ajustadas aceptan un create completo solo si estan presentes nombre,
sexo, nivel, mano y posicion. Esto evita volver a admitir documentos fantasma con
solo `online` y `lastSeen`.

## Inventario de escrituras

| Area | Ruta | Operaciones y ejecutor | Campos principales / efecto cruzado |
|---|---|---|---|
| Registro/perfil | `usuarios/{uid}` | get, create, set merge, update, delete por propietario | perfil, foto, presencia, guia, eliminacion; sin privilegios |
| Social/ranking | `usuarios/{otroUid}` | update, batch y transaction por autenticado | seguidores, clasificacion, nivel, penalizaciones y restricciones |
| Lecturas propias | `usuarios/{uid}/chatLeidos/{id}` | get/set/delete por propietario | marcas de lectura |
| Pistas | `pistas/{id}` | list; create por usuario; update/delete por admin; batch de autor al borrar perfil | datos, imagen, verificacion y autoria |
| Partidas | `partidas/{id}` | list/create/update/delete, batch y transaction desde clientes | plazas, estados, sustituciones, resultado, valoraciones y chat |
| Chat general | `chats/general` y mensajes | set/update/delete por usuarios completos | metadatos, texto, Sistema y retencion |
| Chat privado | `chatsPrivados/{id}` y mensajes | create/update/delete por participantes | participantes, metadatos, texto y baja de perfil |
| Historial | `historial_partidas/{id}` | list/create/update desde clientes | cierre, estadisticas y anonimizacion |
| Notificaciones | `notificaciones/{id}` | query/create/update/delete/batch/transaction | avisos propios y de terceros, agrupacion y limpieza |
| Storage perfil | `usuarios/{uid}/foto_*.jpg`, rutas legacy | put/get/delete por propietario | JPEG hasta 450 KiB |
| Storage pistas | `pistas/{timestamp}.jpg`, ruta legacy | create autenticado; replace/delete admin | JPEG hasta 900 KiB |

## Simulacion de los 75 flujos

Leyenda: P = reglas publicadas; A = propuesta anterior; D = reglas definitivas.
`SI*` indica permiso funcional con riesgo residual.

| # | Flujo | Operacion / ruta / ejecutor | P | A | D | Resultado y cambio |
|---:|---|---|:---:|:---:|:---:|---|
| 1 | Crear usuario incompleto | create `usuarios/propio` | SI | SI | SI | Esquema minimo cerrado |
| 2 | Completar perfil | update o create defensivo propio | SI | NO* | SI | Create completo exige cinco campos |
| 3 | Editar perfil propio | update propio | SI | SI | SI | `admin/rol` inmutables |
| 4 | Cambiar foto | Storage put + update propio | ? | SI | SI | Propietario, JPEG <=450 KiB |
| 5 | Eliminar foto | update propio + Storage delete | ? | SI | SI | Solo rutas del UID |
| 6 | Cancelar registro | delete usuario propio | SI | SI | SI | Compatible |
| 7 | Eliminar perfil completo | queries y batches cruzados | PARCIAL | SI* | SI* | Requiere permisos temporales cruzados |
| 8 | Presencia online | get + update propio | SI | SI | SI | Solo perfil completo |
| 9 | Cambiar admin/rol | update propio | NO | NO | NO | Bloqueado expresamente |
| 10 | Crear pista con imagen | Storage create + Firestore create | SI | SI | SI | Imagen Firestore obligatoria |
| 11 | Editar pista propia no admin | update pista | SI | NO | NO | La interfaz solo ofrece edicion a admin |
| 12 | Editar pista como admin | update pista | SI | SI | SI | Compatible |
| 13 | Verificar pista | update admin | SI | SI | SI | Compatible |
| 14 | Eliminar pista | delete admin | SI | SI | SI | Compatible |
| 15 | Sustituir imagen pista | create nueva, update, delete antigua admin | ? | SI | SI | Admin y JPEG <=900 KiB |
| 16 | Borrar imagen antigua | Storage delete admin | ? | SI | SI | Compatible |
| 17 | Crear partida | create por creador completo | SI | SI | SI | Estado abierta, listas iniciales cerradas |
| 18 | Unirse | transaction update partida | SI* | SI* | SI* | Update autenticado temporal |
| 19 | Salir abierta | transaction update/delete | SI* | SI* | SI* | Temporal |
| 20 | Salir confirmada | transaction partida + usuario | SI* | SI* | SI* | Penalizacion cruzada temporal |
| 21 | Apuntarse reserva | transaction update | SI* | SI* | SI* | Temporal |
| 22 | Reserva sube | transaction update | SI* | SI* | SI* | Temporal |
| 23 | Reserva acepta | transaction update | SI* | SI* | SI* | Temporal |
| 24 | Reserva rechaza | transaction update | SI* | SI* | SI* | Temporal |
| 25 | Confirmar partida | transaction creador | SI* | SI* | SI* | Regla no puede validar toda la maquina de estados |
| 26 | Cambio de creador | transaction update | SI* | SI* | SI* | Temporal |
| 27 | Cancelacion automatica | transaction delete/update | SI* | SI* | SI* | Puede ejecutarla un cliente no participante |
| 28 | Limpieza 5 horas | list + transaction | SI* | SI* | SI* | Temporal |
| 29 | Limpieza pasadas | list + update/delete | SI* | SI* | SI* | Temporal |
| 30 | Chat general texto | read/create mensaje + metadata | SI | SI | SI | Exige perfil completo y autor |
| 31 | Mensajes Sistema | transaction create/update | SI* | SI* | SI* | Forma validada, autoridad cliente |
| 32 | Retencion general | query + delete mensajes ajenos | SI* | SI* | SI* | Permiso temporal documentado |
| 33 | Crear chat privado | create/set merge | SI* | SI | SI | Dos participantes y mapa exacto |
| 34 | Leer chat privado | query/read participante | SI | SI | SI | Compatible |
| 35 | Escribir chat privado | batch mensaje + metadata | SI | SI | SI | Autor y participante |
| 36 | Impedir tercero privado | get/list/mensajes | NO* | SI | SI | Produccion filtra get, pero permite list global |
| 37 | Leer chat partida | read participante/reserva | SI | SI | SI | Compatible |
| 38 | Escribir chat partida | create participante/reserva | SI | SI | SI | Autor obligatorio |
| 39 | Impedir no participante | read/create | SI | SI | SI | Denegado |
| 40 | Introducir resultado | transaction update partida | SI* | SI* | SI* | Temporal |
| 41 | Validar resultado | transaction update | SI* | SI* | SI* | Temporal |
| 42 | Rechazar resultado | transaction update | SI* | SI* | SI* | Temporal |
| 43 | Disputa | transaction update | SI* | SI* | SI* | Temporal |
| 44 | Nuevo resultado | set merge/update | SI* | SI* | SI* | Temporal |
| 45 | Valoraciones | transaction partida + usuarios | PARCIAL | SI* | SI* | Clasificacion de terceros |
| 46 | Cierre partida | update partida | SI* | SI* | SI* | Temporal |
| 47 | Guardar historial | create/update historial | SI* | SI* | SI* | Autoridad cliente |
| 48 | Aplicar ranking | transaction sobre cuatro usuarios | NO/PARCIAL | SI* | SI* | Campos cruzados limitados |
| 49 | Penalizaciones | update usuario ajeno y partida | NO/PARCIAL | SI* | SI* | Campos cruzados limitados |
| 50 | Incidencias | update partida/usuarios | NO/PARCIAL | SI* | SI* | Temporal |
| 51 | Notificacion propia | create notificacion | SI* | SI* | SI* | Coleccion temporalmente abierta |
| 52 | Notificacion a terceros | create para otro UID | SI* | SI* | SI* | Imprescindible hoy |
| 53 | Leer propias | query por uid | SI* | SI* | SI* | Amplio por otras consultas |
| 54 | Marcar propia leida | delete propia / set popup | SI* | SI* | SI* | Compatible |
| 55 | Resolver por partida | query por partidaId + batch delete | SI* | SI* | SI* | Query no acotada por destinatario |
| 56 | Limpiar al borrar perfil | queries, delete y anonimizar ajenas | SI* | SI* | SI* | Temporal |
| 57 | Notificaciones agrupadas | transaction set documento tercero | SI* | SI* | SI* | Temporal |
| 58 | Botones con acciones | read/delete propia + navegacion | SI | SI | SI | Compatible |
| 59 | Seguir usuario | update propio y ajeno | NO/PARCIAL | SI* | SI* | Solo seguidores/siguiendo |
| 60 | Dejar de seguir | update propio y ajeno | NO/PARCIAL | SI* | SI* | Solo campos sociales |
| 61 | Ambos perfiles sociales | Promise updates cruzados | NO/PARCIAL | SI* | SI* | Temporal |
| 62 | Mapas companeros/rivales | batch clasificacion ajena | NO/PARCIAL | SI* | SI* | Top-level clasificacion sigue expuesto |
| 63 | Ver jugadores | list usuarios | SI | SI | SI | Necesario |
| 64 | Ver clasificacion | list + recalculo clasificacion ajena | PARCIAL | SI* | SI* | Recalculo cliente |
| 65 | Estadisticas admin | list usuarios/historial/pistas/partidas | SI | SI | SI | Lecturas conservadas |
| 66 | Auditar incompletos | list usuarios por admin UI | SI | SI | SI | Regla permite list autenticado |
| 67 | Anonimizar al borrar perfil | batches en usuarios/pistas/partidas/historial/avisos | PARCIAL | SI* | SI* | Permisos temporales imprescindibles |
| 68 | Subir foto perfil | Storage create propietario | ? | SI | SI | Nombre, MIME y limite validados |
| 69 | Cambiar foto perfil | create + Firestore update + delete | ? | SI | SI | Compatible |
| 70 | Eliminar foto perfil | Storage delete propietario | ? | SI | SI | Compatible |
| 71 | Subir imagen pista | Storage create autenticado | ? | SI* | SI* | Ruta sin UID |
| 72 | Cambiar imagen pista | create/update/delete admin | ? | SI | SI | Compatible |
| 73 | Borrar imagen pista | delete admin | ? | SI | SI | Creador no admin no puede |
| 74 | Impedir borrar imagen ajena | delete Storage | ? | SI | SI | Perfil por UID; pista solo admin |
| 75 | Limites MIME/tamano | upload JPEG optimizado | ? | SI | SI | 450/900 KiB coinciden con app |

`?`: no se proporcionaron las reglas Storage publicadas.

## Reglas peligrosas descartadas

- Propietario estricto en `usuarios`: rompe seguidores, ranking, valoraciones,
  penalizaciones y limpieza de perfil.
- Participante estricto en `partidas.update/delete`: rompe limpiezas globales
  ejecutadas desde clientes.
- Destinatario estricto en notificaciones: rompe avisos a terceros, queries por
  partida y anonimizacion.
- Historial solo admin: rompe cierre y eliminacion de perfil.
- Mensajes generales borrables solo por autor: rompe retencion y baja de perfil.
- Pistas editables por cualquier autenticado: funcional, pero inseguro e
  innecesario porque la interfaz solo permite editar a admin.
- Storage de pistas borrable por cualquier autenticado: no permite demostrar
  propiedad y por tanto no es aceptable.

## Permisos abiertos temporalmente

1. `partidas.update/delete` para cualquier autenticado: toda la maquina de
   estados, limpiezas y postpartido vive en clientes.
2. Update cruzado de determinados campos de `usuarios`: social, ranking,
   nivel, valoraciones y penalizaciones.
3. `historial_partidas` completo para autenticados: cierre, estadisticas y
   anonimizacion se hacen en cliente.
4. `notificaciones` completo para autenticados: se crean para terceros y se
   consultan/limpian por campos distintos de UID.
5. Creacion/modificacion de mensajes Sistema por usuarios completos.
6. Borrado de mensajes generales por usuarios completos para retencion.
7. Creacion de `pistas/{timestamp}.jpg` por cualquier autenticado: la ruta no
   contiene propietario.

Estos permisos no son seguros frente a un cliente manipulado. Son compatibilidad
temporal explicita, no una frontera de autorizacion completa.

## Seguridad futura con Cloud Functions

1. Funcion transaccional para unirse, salir, reservas, sustituciones, confirmar,
   cancelar y limpiezas.
2. Funcion de resultados, valoraciones, ranking, nivel, incidencias y sanciones.
3. Funcion de cierre inmutable y escritura de historial.
4. Funcion para mensajes Sistema y retencion mediante TTL/backend.
5. Funcion para crear, agrupar, resolver y anonimizar notificaciones.
6. Funcion Admin SDK para eliminacion/anonimizacion integral de perfil.
7. Migracion Storage a `pistas/{uid}/{archivo}` y almacenamiento de la ruta en
   el documento de pista.

Despues de esas migraciones se pueden retirar todos los permisos marcados
`TEMPORAL`.

## Pruebas reales despues de publicar

Ejecutar primero en Emulator o staging con usuario A, usuario B, tercero C y
admin:

1. Completar los 75 casos de la tabla y registrar exito o `permission-denied`.
2. Repetir registro con documento incompleto existente y con el documento
   eliminado antes de completar perfil.
3. Intentar crear `usuarios/{uid}` con solo `online/lastSeen`: debe fallar.
4. Intentar escribir `admin:true`, modificar `rol` e inyectar `email`.
5. Verificar que C no puede consultar ni abrir chats privados de A/B.
6. Verificar que un no participante no lee ni escribe chat de partida.
7. Probar imagenes en 449/451 KiB y 899/901 KiB, JPEG y MIME falso.
8. Probar pista sin foto: debe detenerse antes de Storage/Firestore.
9. Eliminar perfiles con seguidores, chats, partidas, historial, notificaciones
   y fotos legacy.
10. Revisar logs de `permission-denied`, documentos huerfanos y batches
    parcialmente fallidos.

Si falla una prueba: no relajar globalmente. Capturar ruta, operacion, UID,
estado previo, payload y codigo exacto; reproducir en Emulator; ampliar solo la
condicion/campo necesario; repetir los 75 casos y las pruebas negativas.

## Veredicto

- Publicables ahora sin pruebas: **no**.
- Publicables con riesgo residual: **si, solo tras compilar y superar staging**.
- Seguridad definitiva fuerte: **no alcanzable todavia sin Cloud Functions**.

Los archivos completos candidatos son `firestore.rules` y `storage.rules`.
No deben desplegarse directamente a produccion antes de completar la bateria.

