# Adder Pages

Editor estático de JSONs no formato Cubari, feito para rodar direto no GitHub Pages.

Ele não usa backend, FastAPI, banco de dados nem servidor próprio. O site é apenas HTML, CSS e JavaScript. O salvamento acontece diretamente no repositório por meio da API do GitHub.

## O que ele faz

- Conecta em um repositório do GitHub usando username + Personal Access Token.
- Lista arquivos `.json` de uma pasta do repositório.
- Mostra os mangás em cards com capa, título, capítulos e quantidade de imagens.
- Edita campos principais do JSON:
  - `title`
  - `description`
  - `author`
  - `artist`
  - `cover`
  - `chapters`
- Permite adicionar/remover capítulos.
- Permite adicionar/remover grupos por capítulo.
- Permite colar várias URLs de imagens, uma por linha.
- Salva o JSON no GitHub com commit automático.
- Copia o link raw do JSON.

## Estrutura dos arquivos

```txt
adder-github-pages/
├─ index.html
├─ styles.css
├─ app.js
├─ github.js
├─ cubari.js
├─ README.md
└─ .gitignore
```

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Coloque todos estes arquivos na raiz do repositório.
3. Faça commit e push:

```bash
git init
git add .
git commit -m "Initial Adder Pages"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
git push -u origin main
```

4. No GitHub, vá em:

```txt
Settings → Pages → Build and deployment
```

5. Escolha:

```txt
Source: Deploy from a branch
Branch: main
Folder: / root
```

6. Salve. O site ficará em algo como:

```txt
https://SEU-USUARIO.github.io/NOME-DO-REPO/
```

## Como criar o token

Use um **Fine-grained Personal Access Token** limitado apenas ao repositório onde estão os JSONs.

Permissões recomendadas:

```txt
Repository permissions:
Contents: Read and write
Metadata: Read-only
```

Evite usar token clássico com acesso amplo à conta inteira.

## Formato esperado do JSON

Exemplo básico:

```json
{
  "title": "Nome do Mangá",
  "description": "Descrição",
  "artist": "Artista",
  "author": "Autor",
  "cover": "https://exemplo.com/capa.jpg",
  "chapters": {
    "1": {
      "title": "Capítulo 1",
      "volume": "",
      "last_updated": "1710000000",
      "groups": {
        "": [
          "https://exemplo.com/001.jpg",
          "https://exemplo.com/002.jpg"
        ]
      }
    }
  }
}
```

## Observações importantes

- O token só é salvo no navegador se você marcar a opção **Lembrar token neste navegador**.
- Se você mudar o nome de um arquivo já existente, o app cria/atualiza o novo arquivo, mas não apaga automaticamente o antigo.
- O app não hospeda imagens. Ele apenas salva URLs de imagens no JSON.
- Se o repositório for privado, o app ainda consegue editar usando token, mas o link raw pode não abrir publicamente sem autenticação.
