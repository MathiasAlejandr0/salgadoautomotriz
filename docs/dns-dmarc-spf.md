# Correo de salgadoautomotriz.cl

Estos registros se publican a mano en el DNS de HostGator
(`ns00008.hostgator.cl` / `ns00009.hostgator.cl`).
Este repositorio no modifica el DNS.

Consultados el 22 de octubre de 2026.

## SPF

Ya existe. No hace falta crear otro. El TXT publicado en el apex es:

```txt
v=spf1 +a +mx +ip4:69.6.225.166 +include:websitewelcome.com ~all
```

Host: `salgadoautomotriz.cl`
Tipo: `TXT`

MX actual: `0 mail.salgadoautomotriz.cl.`

## DMARC

No hay registro en `_dmarc.salgadoautomotriz.cl`. Crear este TXT:

Host: `_dmarc.salgadoautomotriz.cl`
Tipo: `TXT`
Valor:

```txt
v=DMARC1; p=quarantine; pct=100; rua=mailto:contacto@salgadoautomotriz.cl; ruf=mailto:contacto@salgadoautomotriz.cl; fo=1; adkim=r; aspf=r; sp=quarantine
```

`p=quarantine` pide a los receptores que pongan en cuarentena el correo que falle SPF y DKIM.
El buzón `contacto@salgadoautomotriz.cl` debe existir para recibir los reportes `rua`.
Si ese buzón no lee reportes, cambiar solo la dirección `mailto:` antes de publicarlo.
No bajar a `p=none` si el objetivo es cerrar la auditoría.
