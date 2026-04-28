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
- Importa imagens de álbuns ImgChest usando a API oficial do ImgChest quando você informa um ImgChest API token.
- Extrai URLs `cdn.imgchest.com` de texto colado no campo de imagens.
- Salva o JSON no GitHub com commit automático.
- Copia o link raw do JSON.
- Gera e copia a URL final do Cubari no formato `https://cubari.moe/read/gist/.../`.

## Estrutura dos arquivos

```txt
adder-github-pages/
├─ index.html
├─ styles.css
├─ app.js
├─ github.js
├─ cubari.js
├─ imgchest.js
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

## URL final do Cubari

O app gera automaticamente o link final do Cubari a partir do caminho raw do GitHub.

Exemplo:

```txt
raw/revon-dot/OP/main/HxH.json
```

vira:

```txt
https://cubari.moe/read/gist/cmF3L3Jldm9uLWRvdC9PUC9tYWluL0h4SC5qc29u/
```

No dashboard, use **Copiar Cubari**. Dentro do editor, a URL aparece na caixa **Links** depois que o arquivo já existe no GitHub.

## ImgChest scraper no GitHub Pages

O antigo `imgchest_scraper.py` usava Playwright para abrir o álbum, clicar em “Load More Files”, rolar a página e capturar as imagens. Isso funciona localmente com Python, mas não funciona diretamente no GitHub Pages porque o GitHub Pages só executa HTML/CSS/JavaScript no navegador.

Nesta versão estática, o app tenta importar ImgChest assim:

1. Pelo endpoint oficial do ImgChest, quando você informa um **ImgChest API token**.
2. Como fallback, tentando ler a página pública do álbum. Esse fallback pode ser bloqueado por CORS dependendo do navegador/ImgChest.
3. Como alternativa manual, você pode colar URLs ou HTML/texto com links `https://cdn.imgchest.com/files/...` e clicar em **Extrair URLs coladas**.

O ImgChest API token é diferente do GitHub Personal Access Token.

## Como criar o token

Use um **Fine-grained Personal Access Token** limitado apenas ao repositório onde estão os JSONs. O próprio site mostra esse passo a passo na tela de conexão.

Passo a passo:

1. Entre na sua conta do GitHub.
2. Vá em `Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token`.
3. Em `Token name`, use algo como `Adder Pages`.
4. Em `Expiration`, escolha uma validade, por exemplo `90 days`.
5. Em `Resource owner`, escolha o dono do repositório.
6. Em `Repository access`, escolha `Only select repositories` e selecione só o repositório dos JSONs.
7. Em `Repository permissions`, marque:

```txt
Contents: Read and write
Metadata: Read-only
```

8. Clique em `Generate token`.
9. Copie o token e cole no campo `Personal Access Token` do site. O GitHub só mostra o token uma vez.

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
