# Запекание портретов 42-завров

Разовая джоба: рендерит 12 персонажей ростера (`src/lib/zavri/catalog.ts`) в PNG
1024×1024 → `public/images/zavri/<id>.png` для временных баннеров гачи, reveal-экрана
и карточек коллекции.

## Почему так

- **Без Chrome/Playwright** — software WebGL через `gl` (headless-gl) + Xvfb, потребление
  памяти ~100 МБ на разовый прогон.
- **Без Obscura** — Obscura не выполняет пиксельный рендеринг (в её доке: *«does not
  support screenshots as it does not perform pixel rendering»*), WebGL у неё отсутствует.
- three зафиксирован на **0.152.2** — последняя версия с поддержкой WebGL1, который
  даёт headless-gl. В основном приложении — three 0.185; обе версии потребляют одну и ту
  же геометрию из `src/lib/zavri` (catalog + mesh + adapterFactory), поэтому запечённые
  картинки и живые модели в террариуме совпадают 1:1.

## Установка (один раз)

Системные зависимости (Debian/Ubuntu):

```bash
apt-get install -y --no-install-recommends build-essential python-is-python3 pkg-config \
  libxi-dev libglu1-mesa-dev libglew-dev mesa-common-dev libosmesa6-dev xvfb
```

Зависимости ноды + сборка нативных биндингов:

```bash
bash setup.sh
```

## Запекание

```bash
bun build entry.ts --target=node --outfile=zavri-core.mjs
xvfb-run -a node bake.mjs
```

`zavri-core.mjs` — самодостаточный бандл ядра завров (без three), собирается bun'ом,
исполняется node'ом (нативный `gl` собран под Node ABI; под Bun напрямую не работает).

## Когда перезапекать

- изменили ростер/черты/цвета в `src/lib/zavri/catalog.ts` или сцену в `bake.mjs`;
- добавили нового завра — файл `<id>.png` появится автатически.
