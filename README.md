# Adder Pages

## Português

Editor visual e estático para gerenciar JSONs compatíveis com Cubari, feito para rodar direto no navegador.

O Adder Pages não usa backend, FastAPI, banco de dados nem servidor próprio. Ele é um site feito com HTML, CSS e JavaScript puro. O carregamento, a criação, a edição e a exclusão dos arquivos acontecem diretamente no repositório configurado por meio da API do GitHub.

## Visão geral

O objetivo do Adder Pages é facilitar a manutenção de obras no formato Cubari sem precisar editar JSON manualmente.

Com ele, você conecta um repositório do GitHub, escolhe a pasta onde ficam os JSONs, edita as obras visualmente e salva tudo de volta no GitHub com commit automático.

## O que ele faz

- Conecta a um repositório do GitHub usando um Personal Access Token.
- Permite configurar owner, repositório, branch e pasta onde ficam os JSONs.
- Lista arquivos `.json` encontrados na pasta configurada.
- Mostra as obras em uma biblioteca/tabela com capa, título, nome do arquivo, quantidade de capítulos e ações.
- Permite buscar obras por título ou nome do arquivo.
- Cria novos JSONs compatíveis com Cubari.
- Edita os campos principais da obra:
  - `title`
  - `description`
  - `author`
  - `artist`
  - `cover`
  - `chapters`
- Gera automaticamente o nome do arquivo para obras novas a partir do título.
- Permite adicionar, editar e remover capítulos.
- Permite configurar número, título, volume, grupo, timestamp e URLs de imagens por capítulo.
- Permite colar várias URLs de imagens, uma por linha.
- Importa imagens de álbuns ImgChest usando a API oficial do ImgChest quando você informa um ImgChest API token.
- Tenta ler a página pública do ImgChest como fallback, quando possível.
- Salva o JSON no GitHub com commit automático.
- Permite deletar uma obra/JSON existente do repositório.
- Gera e copia a URL final do Cubari.
- Mostra aviso ao tentar sair do editor com alterações não salvas.
- Tem interface em português brasileiro e inglês americano.
- Salva configurações no navegador quando o usuário escolhe lembrar os dados.

## Fluxo do site

O app é organizado em quatro etapas principais.

### 1. Tela inicial

A primeira tela apresenta o Adder Pages e oferece os atalhos principais:

- começar uma nova conexão;
- carregar dados salvos neste navegador;
- abrir o guia rápido de funcionamento;
- trocar o idioma entre PT e EN.

### 2. Conexão com o GitHub

Na tela de conexão, você informa:

- GitHub username;
- Personal Access Token;
- owner do repositório;
- nome do repositório;
- branch;
- pasta onde ficam os JSONs;
- ImgChest API token opcional.

O próprio site mostra um guia para criar um Fine-grained Personal Access Token com a permissão mínima necessária.

### 3. Dashboard / Biblioteca

Depois de conectar, o dashboard carrega os JSONs encontrados na pasta configurada e mostra uma biblioteca com:

- capa;
- título da obra;
- nome do arquivo;
- quantidade de capítulos;
- botão de editar;
- botão de copiar link Cubari.

Também é possível criar uma nova obra, atualizar a listagem, buscar por título/arquivo ou trocar o repositório configurado.

### 4. Editor

No editor, você pode alterar os dados principais da obra e gerenciar capítulos.

O editor permite:

- editar título, descrição, artista, autor e capa;
- adicionar capítulo;
- editar capítulo existente;
- remover capítulo;
- importar imagens de um álbum ImgChest;
- salvar alterações no GitHub;
- abrir o arquivo salvo no GitHub;
- copiar o link Cubari;
- deletar a obra do repositório.

Se houver alterações não salvas e você tentar sair do editor, o app mostra um aviso antes de abandonar a tela.

## Estrutura atual dos arquivos

```txt
Adder/
├─ index.html
├─ styles.css
├─ editor-overrides.css
├─ logo-overrides.css
├─ favicon.svg
├─ app.js
├─ github.js
├─ repo.js
├─ cubari.js
├─ imgchest.js
├─ state.js
├─ ui.js
├─ utils.js
├─ i18n.js
├─ clipboard.js
├─ modals.js
├─ editor-collector.js
├─ editor-stats.js
├─ views/
│  ├─ landing.js
│  ├─ connect.js
│  ├─ connect-page.js
│  ├─ connect-events.js
│  ├─ dashboard.js
│  ├─ dashboard-page.js
│  ├─ dashboard-events.js
│  ├─ editor.js
│  ├─ editor-page.js
│  ├─ editor-events.js
│  ├─ editor-renderers.js
│  ├─ editor-save.js
│  └─ chapter-modal.js
├─ README.md
└─ .gitignore
```

A aplicação usa módulos JavaScript nativos. O arquivo `app.js` é o ponto de entrada e coordena a navegação entre landing page, conexão, dashboard e editor.

## Como criar o token do GitHub

Use um **Fine-grained Personal Access Token** limitado ao repositório onde estão os JSONs.

Passo a passo:

1. Entre na sua conta do GitHub.
2. Vá em `Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token`.
3. Em `Token name`, use algo como `Adder Pages`.
4. Em `Expiration`, escolha uma validade, por exemplo `90 days`.
5. Em `Resource owner`, escolha o dono do repositório.
6. Em `Repository access`, escolha `Only select repositories` e selecione o repositório dos JSONs.
7. Em `Repository permissions`, marque:

```txt
Contents: Read and write
Metadata: Read-only
```

8. Clique em `Generate token`.
9. Copie o token e cole no campo `Personal Access Token` do Adder Pages.

O GitHub só mostra o token uma vez. Guarde em local seguro se precisar reutilizá-lo.

## Sobre o salvamento no GitHub

Quando você clica em **Salvar no GitHub**, o app monta o JSON atualizado e envia para o repositório usando a API do GitHub.

O commit gerado segue mensagens como:

```txt
Create nome-do-arquivo.json via Adder Pages
Update nome-do-arquivo.json via Adder Pages
Delete nome-do-arquivo.json via Adder Pages
```

Se você mudar o nome de um arquivo já existente, o app cria ou atualiza o novo arquivo, mas não apaga automaticamente o antigo. Essa decisão evita apagar arquivos por engano.

## URL final do Cubari

O app gera automaticamente o link final do Cubari a partir do caminho raw do GitHub.

Exemplo de caminho genérico:

```txt
raw/OWNER/REPOSITORY/BRANCH/path/to/manga.json
```

Esse caminho é convertido em uma URL Cubari no formato:

```txt
https://cubari.moe/read/gist/<base64-do-caminho-raw>/
```

No dashboard, use **Copiar Cubari**.

Dentro do editor, a opção de copiar Cubari aparece depois que o arquivo já existe no GitHub.

## ImgChest

O Adder Pages pode importar imagens de álbuns ImgChest para preencher automaticamente a lista de URLs de um capítulo.

Como o site roda no navegador, ele não consegue executar Python, Playwright ou scripts locais. Por isso, a importação funciona assim:

1. Primeiro, tenta usar o endpoint oficial do ImgChest quando você informa um **ImgChest API token**.
2. Se não houver token, tenta ler a página pública do álbum diretamente pelo navegador.
3. Se o navegador bloquear a leitura por CORS, será necessário usar um ImgChest API token ou colar manualmente as URLs das imagens.

O ImgChest API token é diferente do GitHub Personal Access Token.

### Fluxo para adicionar capítulo com ImgChest

1. Abra uma obra no editor.
2. Clique em **Adicionar Capítulo**.
3. Preencha número, título, volume e grupo.
4. Cole a URL do álbum ImgChest.
5. Clique em **Importar ImgChest**.
6. Confira as URLs importadas.
7. Clique em **Criar Capítulo** ou **Salvar Capítulo**.
8. Clique em **Salvar no GitHub**.

## Formato esperado do JSON

Exemplo básico de JSON compatível:

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

### Campos principais

| Campo | Descrição |
|---|---|
| `title` | Nome da obra. |
| `description` | Descrição da obra. |
| `artist` | Nome do artista. |
| `author` | Nome do autor. |
| `cover` | URL da imagem de capa. |
| `chapters` | Objeto com os capítulos da obra. |

### Campos de capítulo

| Campo | Descrição |
|---|---|
| `title` | Título do capítulo. |
| `volume` | Volume do capítulo. Pode ficar vazio. |
| `last_updated` | Timestamp Unix em segundos. |
| `groups` | Grupos de leitura e suas respectivas URLs de imagens. |

O nome do grupo pode ficar vazio:

```json
"groups": {
  "": [
    "https://exemplo.com/001.jpg"
  ]
}
```

## Idiomas

A interface tem suporte a:

- português brasileiro;
- inglês americano.

A escolha de idioma é salva no navegador.

## Dados salvos no navegador

O Adder Pages pode salvar algumas informações localmente no navegador para facilitar o uso:

- owner do repositório;
- nome do repositório;
- branch;
- pasta dos JSONs;
- idioma escolhido;
- token do GitHub, se você marcar a opção para lembrar;
- token do ImgChest, se você marcar a opção para lembrar.

Use a opção de lembrar tokens apenas em computadores confiáveis.

## Observações importantes

- O Adder Pages não hospeda imagens.
- O app apenas salva URLs de imagens no JSON.
- O app não publica capítulos sozinho; ele edita o arquivo JSON usado pelo Cubari.
- O token do GitHub precisa ter permissão de leitura e escrita em conteúdo do repositório.
- Se o ImgChest falhar por CORS, use um ImgChest API token ou cole as URLs manualmente.
- Alterações só entram no repositório depois de clicar em **Salvar no GitHub**.

## Desenvolvimento local

Como o projeto usa módulos JavaScript nativos, é melhor rodar com um servidor local simples em vez de abrir o `index.html` diretamente pelo navegador.

Exemplo com Python:

```bash
python -m http.server 8000
```

Depois abra:

```txt
http://localhost:8000/
```

Também é possível usar qualquer servidor estático, como Live Server, `npx serve` ou equivalente.

---

## English

Visual static editor for managing Cubari-compatible JSON files, designed to run directly in the browser.

Adder Pages does not use a backend, FastAPI, database, or custom server. It is a plain HTML, CSS, and JavaScript site. Loading, creating, editing, and deleting files happens directly in the configured repository through the GitHub API.

## Overview

The goal of Adder Pages is to make it easier to maintain Cubari-format works without editing JSON manually.

With it, you connect a GitHub repository, choose the folder where the JSON files are stored, edit works visually, and save everything back to GitHub with automatic commits.

## What it does

- Connects to a GitHub repository using a Personal Access Token.
- Lets you configure the owner, repository, branch, and folder where the JSON files are stored.
- Lists `.json` files found in the configured folder.
- Displays works in a library/table with cover, title, file name, chapter count, and actions.
- Lets you search works by title or file name.
- Creates new Cubari-compatible JSON files.
- Edits the main work fields:
  - `title`
  - `description`
  - `author`
  - `artist`
  - `cover`
  - `chapters`
- Automatically generates the file name for new works from the title.
- Lets you add, edit, and remove chapters.
- Lets you configure chapter number, title, volume, group, timestamp, and image URLs.
- Lets you paste multiple image URLs, one per line.
- Imports images from ImgChest albums using the official ImgChest API when you provide an ImgChest API token.
- Tries to read the public ImgChest page as a fallback when possible.
- Saves the JSON to GitHub with an automatic commit.
- Lets you delete an existing work/JSON file from the repository.
- Generates and copies the final Cubari URL.
- Warns you when leaving the editor with unsaved changes.
- Supports Brazilian Portuguese and American English.
- Saves configuration in the browser when the user chooses to remember the data.

## Site flow

The app is organized into four main steps.

### 1. Landing page

The first screen introduces Adder Pages and provides the main shortcuts:

- start a new connection;
- load saved data from this browser;
- open the quick “How it works” guide;
- switch the interface language between PT and EN.

### 2. GitHub connection

On the connection screen, you provide:

- GitHub username;
- Personal Access Token;
- repository owner;
- repository name;
- branch;
- folder where the JSON files are stored;
- optional ImgChest API token.

The site itself includes a guide for creating a Fine-grained Personal Access Token with the minimum required permission.

### 3. Dashboard / Library

After connecting, the dashboard loads the JSON files found in the configured folder and displays a library with:

- cover;
- work title;
- file name;
- chapter count;
- edit button;
- copy Cubari link button.

You can also create a new work, refresh the list, search by title/file, or change the configured repository.

### 4. Editor

In the editor, you can change the main work data and manage chapters.

The editor lets you:

- edit title, description, artist, author, and cover;
- add a chapter;
- edit an existing chapter;
- remove a chapter;
- import images from an ImgChest album;
- save changes to GitHub;
- open the saved file on GitHub;
- copy the Cubari link;
- delete the work from the repository.

If there are unsaved changes and you try to leave the editor, the app shows a warning before abandoning the screen.

## Current file structure

```txt
Adder/
├─ index.html
├─ styles.css
├─ editor-overrides.css
├─ logo-overrides.css
├─ favicon.svg
├─ app.js
├─ github.js
├─ repo.js
├─ cubari.js
├─ imgchest.js
├─ state.js
├─ ui.js
├─ utils.js
├─ i18n.js
├─ clipboard.js
├─ modals.js
├─ editor-collector.js
├─ editor-stats.js
├─ views/
│  ├─ landing.js
│  ├─ connect.js
│  ├─ connect-page.js
│  ├─ connect-events.js
│  ├─ dashboard.js
│  ├─ dashboard-page.js
│  ├─ dashboard-events.js
│  ├─ editor.js
│  ├─ editor-page.js
│  ├─ editor-events.js
│  ├─ editor-renderers.js
│  ├─ editor-save.js
│  └─ chapter-modal.js
├─ README.md
└─ .gitignore
```

The application uses native JavaScript modules. The `app.js` file is the entry point and coordinates navigation between the landing page, connection screen, dashboard, and editor.

## How to create the GitHub token

Use a **Fine-grained Personal Access Token** limited to the repository where the JSON files are stored.

Step by step:

1. Sign in to your GitHub account.
2. Go to `Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token`.
3. In `Token name`, use something like `Adder Pages`.
4. In `Expiration`, choose an expiration date, for example `90 days`.
5. In `Resource owner`, choose the repository owner.
6. In `Repository access`, choose `Only select repositories` and select the JSON repository.
7. In `Repository permissions`, set:

```txt
Contents: Read and write
Metadata: Read-only
```

8. Click `Generate token`.
9. Copy the token and paste it into the `Personal Access Token` field in Adder Pages.

GitHub only shows the token once. Store it somewhere safe if you need to reuse it.

## About saving to GitHub

When you click **Save to GitHub**, the app builds the updated JSON and sends it to the repository using the GitHub API.

The generated commit uses messages such as:

```txt
Create file-name.json via Adder Pages
Update file-name.json via Adder Pages
Delete file-name.json via Adder Pages
```

If you change the name of an existing file, the app creates or updates the new file, but it does not automatically delete the old one. This avoids accidental file deletion.

## Final Cubari URL

The app automatically generates the final Cubari link from the GitHub raw path.

Generic path example:

```txt
raw/OWNER/REPOSITORY/BRANCH/path/to/manga.json
```

This path is converted into a Cubari URL in this format:

```txt
https://cubari.moe/read/gist/<base64-of-raw-path>/
```

On the dashboard, use **Copy Cubari**.

Inside the editor, the copy Cubari option appears after the file already exists on GitHub.

## ImgChest

Adder Pages can import images from ImgChest albums to automatically fill a chapter's image URL list.

Because the site runs in the browser, it cannot execute Python, Playwright, or local scripts. For that reason, importing works like this:

1. First, it tries to use the official ImgChest endpoint when you provide an **ImgChest API token**.
2. If there is no token, it tries to read the public album page directly through the browser.
3. If the browser blocks the request because of CORS, you will need to use an ImgChest API token or manually paste the image URLs.

The ImgChest API token is different from the GitHub Personal Access Token.

### Flow for adding a chapter with ImgChest

1. Open a work in the editor.
2. Click **Add Chapter**.
3. Fill in number, title, volume, and group.
4. Paste the ImgChest album URL.
5. Click **Import ImgChest**.
6. Check the imported URLs.
7. Click **Create Chapter** or **Save Chapter**.
8. Click **Save to GitHub**.

## Expected JSON format

Basic example of a compatible JSON:

```json
{
  "title": "Manga Name",
  "description": "Description",
  "artist": "Artist",
  "author": "Author",
  "cover": "https://example.com/cover.jpg",
  "chapters": {
    "1": {
      "title": "Chapter 1",
      "volume": "",
      "last_updated": "1710000000",
      "groups": {
        "": [
          "https://example.com/001.jpg",
          "https://example.com/002.jpg"
        ]
      }
    }
  }
}
```

### Main fields

| Field | Description |
|---|---|
| `title` | Work title. |
| `description` | Work description. |
| `artist` | Artist name. |
| `author` | Author name. |
| `cover` | Cover image URL. |
| `chapters` | Object containing the work's chapters. |

### Chapter fields

| Field | Description |
|---|---|
| `title` | Chapter title. |
| `volume` | Chapter volume. Can be empty. |
| `last_updated` | Unix timestamp in seconds. |
| `groups` | Reading groups and their respective image URLs. |

The group name can be empty:

```json
"groups": {
  "": [
    "https://example.com/001.jpg"
  ]
}
```

## Languages

The interface supports:

- Brazilian Portuguese;
- American English.

The selected language is saved in the browser.

## Data saved in the browser

Adder Pages can save some information locally in the browser to make future use easier:

- repository owner;
- repository name;
- branch;
- JSON folder;
- selected language;
- GitHub token, if you choose to remember it;
- ImgChest token, if you choose to remember it.

Only choose to remember tokens on trusted computers.

## Important notes

- Adder Pages does not host images.
- The app only saves image URLs in the JSON.
- The app does not publish chapters by itself; it edits the JSON file used by Cubari.
- The GitHub token needs read and write permission for repository contents.
- If ImgChest fails because of CORS, use an ImgChest API token or paste the URLs manually.
- Changes only reach the repository after clicking **Save to GitHub**.

## Local development

Because the project uses native JavaScript modules, it is better to run it with a simple local server instead of opening `index.html` directly in the browser.

Example with Python:

```bash
python -m http.server 8000
```

Then open:

```txt
http://localhost:8000/
```

You can also use any static server, such as Live Server, `npx serve`, or an equivalent tool.
