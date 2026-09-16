const fs = require('fs');
const SftpClient = require('ssh2-sftp-client');

async function conectar(cfg) {
    const sftp = new SftpClient();
    const opciones = {
        host: cfg.SSH_HOST,
        port: Number(cfg.SSH_PORT || 22),
        username: cfg.SSH_USUARIO
    };

    if (cfg.SSH_KEY_PATH) {
        opciones.privateKey = fs.readFileSync(cfg.SSH_KEY_PATH);
    } else if (cfg.SSH_PASSWORD) {
        opciones.password = cfg.SSH_PASSWORD;
        opciones.tryKeyboard = true;
        // Muchos servidores Ubuntu piden la contraseña via "keyboard-interactive" (PAM) en vez de
        // aceptar el metodo "password" directo. Respondemos ese prompt con la misma contraseña.
        sftp.client.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
            finish(prompts.map(() => cfg.SSH_PASSWORD));
        });
    } else {
        throw new Error('Configura SSH_KEY_PATH o SSH_PASSWORD en .env para poder subir los adjuntos por SFTP');
    }

    await sftp.connect(opciones);
    return sftp;
}

async function subirArchivo(sftp, localPath, remotePath) {
    const dirRemoto = remotePath.substring(0, remotePath.lastIndexOf('/'));
    const existe = await sftp.exists(dirRemoto);
    if (!existe) {
        await sftp.mkdir(dirRemoto, true);
    }
    await sftp.put(localPath, remotePath);
}

module.exports = { conectar, subirArchivo };
