# MCM Repostería

Sitio público y catálogo administrado con el Firebase existente del proyecto `mcm-reposteria`.

## Formulario conectado al cotizador

**Enviar por WhatsApp** sigue abriendo el mensaje del pedido. Al mismo tiempo crea una solicitud inmutable en Firestore, colección `orderRequests`, con los campos del formulario, rellenos y fecha del servidor. El cliente debe terminar de enviar el mensaje en WhatsApp. El sitio muestra por separado si la solicitud fue recibida; si hay problemas de red, debe mantenerse abierto hasta confirmar el guardado. Si Firebase rechaza la solicitud, WhatsApp sigue disponible y el sitio ofrece reintentar con el mismo identificador. Repetir un pedido sin cambios durante esa sesión no crea otra solicitud.

El cotizador en `https://osvillat-alt.github.io/Cotizador/CCMMCM/` recibe estas solicitudes al iniciar sesión con la cuenta administradora. Calcula vistas previas con sus precios locales y las guarda en el mismo historial local de cotizaciones. La autorización ocurre en el cotizador. No se comparte con clientes un precio pendiente de revisión.

## Configuración necesaria antes de activar

Publica esta actualización junto con los cambios del repositorio `osvillat-alt/Cotizador`. En Firebase Authentication agrega el dominio `osvillat-alt.github.io` a **Authorized domains**. Google ya es el método que utiliza `admin.js`; conserva ese proveedor habilitado.

Revisa `firestore.rules` contra las reglas actuales antes de publicarlo en **Firestore Database → Rules**. El archivo contiene las colecciones que usa este código: `products` y `orderRequests`. Conserva cualquier regla necesaria para otras colecciones del proyecto. Las solicitudes aceptan únicamente creaciones públicas con campos y tamaños limitados; sólo las cuentas verificadas `osvillat@gmail.com` y `calderamoralesmarisol@gmail.com` pueden leerlas y eliminarlas. Nadie puede modificar una solicitud ya recibida.

No dejes reglas generales abiertas sobre `orderRequests`: los permisos de Firestore se suman, por lo que un permiso global de lectura también permitiría leer los pedidos. El archivo en GitHub no despliega reglas automáticamente. La configuración pública de Firebase no sustituye esas reglas.

Las solicitudes permanecen en Firebase para poder recuperarlas aunque el cotizador estuviera cerrado. Los precios, autorizaciones y pedidos generados permanecen en cada navegador del cotizador. El formulario acepta hasta 1000 caracteres por campo. Si la referencia es una imagen local cuya subida no terminó, el mensaje y la vista previa solicitan adjuntarla en WhatsApp.

Verificación local sin dependencias ni escrituras reales: `node check.mjs`. La prueba comprueba validación, conservación de WhatsApp, payload, duplicados, errores y reintentos. Después de configurar Firebase, comprueba un pedido de prueba y verifica que una sesión sin autorización no pueda leer `orderRequests`.
