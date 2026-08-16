# Инструкция для агентов

## Работа с GitHub

- Основной репозиторий: `Anton3091/LostHvost`.
- GitHub URL: `https://github.com/Anton3091/LostHvost`.
- Основная ветка: `main`.
- `origin` должен указывать на `https://github.com/Anton3091/LostHvost.git`.
- Для операций с GitHub использовать установленный `gh`; ожидаемая учётная запись: `Anton3091`.

Перед началом работы проверить контекст:

```bash
git status --short --branch
git remote -v
gh auth status
```

В рабочем каталоге могут быть изменения пользователя. Нельзя удалять, откатывать или включать в свой коммит чужие файлы без явного согласования. Служебный каталог `.pnpm-store/` в GitHub не добавлять.

### Публикация изменений

Изменения публикуются через отдельную ветку и pull request:

```bash
git switch -c agent-<краткое-название> origin/main
git add <только-нужные-файлы>
git commit -m "<краткое описание>"
git push -u origin agent-<краткое-название>
gh pr create --repo Anton3091/LostHvost --base main --head agent-<краткое-название>
```

Перед коммитом проверить staged diff и отсутствие секретов:

```bash
git diff --cached --check
git diff --cached
```

В `main` не делать force push. Не переписывать историю и не использовать `git reset --hard`. Pull request сливать только после проверки состава изменений. Обычный способ слияния:

```bash
gh pr merge <номер-pr> --repo Anton3091/LostHvost --merge --delete-branch
```

Слияние в `main` автоматически запускает production-деплой. Документационные изменения тоже запускают workflow, поэтому после merge нужно дождаться его завершения.

### GitHub Actions

Список workflow и последние запуски:

```bash
gh workflow list --repo Anton3091/LostHvost
gh run list --repo Anton3091/LostHvost --workflow deploy.yml --limit 5
```

Проверка конкретного запуска:

```bash
gh run view <run-id> --repo Anton3091/LostHvost
gh run view <run-id> --repo Anton3091/LostHvost --log-failed
```

Если `gh run watch` заканчивает вывод до завершения job, источник истины:

```bash
gh run view <run-id> --repo Anton3091/LostHvost \
  --json status,conclusion,url,jobs
```

Успешным считать только запуск со значениями `status=completed` и `conclusion=success`. После него отдельно проверить публичный `/health/ready` и контейнеры по инструкции ниже.

### Секреты и доступ

- Значения GitHub Actions Secrets нельзя читать в чат, коммитить или сохранять в документацию.
- Разрешено проверять только наличие и дату обновления секретов через `gh secret list --repo Anton3091/LostHvost`.
- Для Actions используется отдельный deploy-ключ с комментарием `github-actions-losthvost`; локальный `~/.ssh/id_rsa` в workflow не используется.
- Закрытый deploy-ключ хранится только в GitHub Secret `DEPLOY_SSH_PRIVATE_KEY`.
- При замене deploy-ключа старую публичную запись нужно удалить из `~/.ssh/authorized_keys` на сервере.
- Production `.env` хранится только в `/opt/losthvost/current/.env` и не переносится через GitHub.

## Продакшен и деплой

- Продакшен: `https://losthvost.ru`.
- Репозиторий: `Anton3091/LostHvost`.
- Сервер: `abolyatko@89.232.188.161`.
- Каталог приложения: `/opt/losthvost/current`.
- Compose-проект: `losthvost`.
- Контейнеры: `losthvost-app-1` и `losthvost-caddy-1`.
- Docker на сервере запускается через `sudo`.

Основной способ выкладки: GitHub Actions, workflow `.github/workflows/deploy.yml`. Он автоматически запускается после push или merge в `main`. Ручной запуск:

```bash
gh workflow run deploy.yml --repo Anton3091/LostHvost --ref main
```

Следить за последним запуском:

```bash
gh run list --repo Anton3091/LostHvost --workflow deploy.yml --limit 1
gh run watch --repo Anton3091/LostHvost
```

Workflow синхронизирует исходники через `rsync`, сохраняет серверный `.env`, не переносит локальные кэши и сборочные каталоги, создаёт резервную копию данных, собирает образ и ждёт успешный ответ `/health/ready`. При ошибке после переключения workflow возвращает предыдущий образ.

Секреты GitHub Actions:

- `DEPLOY_HOST`: адрес сервера.
- `DEPLOY_USER`: SSH-пользователь.
- `DEPLOY_PATH`: `/opt/losthvost/current`.
- `DEPLOY_SSH_PRIVATE_KEY`: закрытый ключ деплоя.
- `DEPLOY_KNOWN_HOSTS`: проверенный SSH host key сервера.

Значения секретов нельзя добавлять в репозиторий, логи, задачи и документацию.

## Правила безопасной выкладки

- Не копировать и не перезаписывать `/opt/losthvost/current/.env`.
- Не удалять Docker volume `losthvost_app_data`: в нём база и загруженные файлы.
- Не запускать `docker compose down -v`.
- Не менять соседние контейнеры и сервисы сервера.
- Перед публикацией проверить, что в staged diff нет ключей и паролей.
- Обычные изменения отправлять через ветку и pull request. Деплой начнётся после слияния в `main`.
- Прямой ручной деплой использовать только при восстановлении после сбоя.

## Проверка после выкладки

Проверить GitHub Actions и публичную готовность:

```bash
curl --fail --silent --show-error https://losthvost.ru/health/ready
```

Если нужно проверить сервер напрямую:

```bash
ssh -i ~/.ssh/id_rsa -o IdentitiesOnly=yes abolyatko@89.232.188.161 \
  'cd /opt/losthvost/current && sudo docker compose ps'
```

Краткий `502` во время пересоздания контейнера может быть окном перезапуска. Итогом считается успешный workflow, здоровый контейнер приложения и стабильный ответ публичного `/health/ready`.

## Тесты

- При добавлении нового функционала обязательно добавлять новые тесты, которые проверяют его основное поведение.
- При изменении существующего функционала нужно обновлять текущие тесты и добавлять проверки для изменившихся сценариев.
- Перед коммитом запускать `pnpm test` и `pnpm lint`. Если проверка недоступна, указать причину в описании результата.

## Резервные копии

- Скрипт: `/opt/losthvost/current/scripts/backup.sh`.
- Каталог: `/opt/losthvost/backups`.
- Workflow запускает резервное копирование перед каждой выкладкой.
- Старые архивы автоматически удаляются через 14 дней.
