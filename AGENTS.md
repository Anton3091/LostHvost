# Инструкция для агентов

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

## Резервные копии

- Скрипт: `/opt/losthvost/current/scripts/backup.sh`.
- Каталог: `/opt/losthvost/backups`.
- Workflow запускает резервное копирование перед каждой выкладкой.
- Старые архивы автоматически удаляются через 14 дней.
