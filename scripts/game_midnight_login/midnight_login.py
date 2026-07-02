#!/usr/bin/env python3
"""
Aguarda o Server Save (SS) do Poketibia e reloga automaticamente no OTClient.

Uso:
  python midnight_login.py          # loop diário no horário do SS
  python midnight_login.py --test   # testa o relogin agora (sem esperar o SS)

Aviso: automação pode violar regras do servidor — use por sua conta e risco.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from poketibia_client import PoketibiaClient, PoketibiaConfig

LOG = logging.getLogger("midnight_login")
SCRIPT_DIR = Path(__file__).resolve().parent


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return default if raw is None else int(raw)


def env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return default if raw is None else float(raw)


def load_config() -> PoketibiaConfig:
    mode = os.environ.get("RELOGIN_MODE", "full").lower()
    account = os.environ.get("ACCOUNT", "")
    password = os.environ.get("PASSWORD", "")

    if mode == "full" and (not account or not password):
        raise ValueError("RELOGIN_MODE=full exige ACCOUNT e PASSWORD no config.env")

    return PoketibiaConfig(
        account=account,
        password=password,
        character_index=env_int("CHARACTER_INDEX", 0),
        window_title_contains=os.environ.get("WINDOW_TITLE_CONTAINS", "OTClient"),
        action_delay_sec=env_float("ACTION_DELAY_SEC", 0.4),
        relogin_mode=mode,
        ss_restart_wait_sec=env_int("SS_RESTART_WAIT_SEC", 90),
        login_retries=env_int("LOGIN_RETRIES", 15),
        login_retry_interval_sec=env_int("LOGIN_RETRY_INTERVAL_SEC", 30),
    )


def next_ss_datetime(tz: ZoneInfo, hour: int, minute: int) -> datetime:
    now = datetime.now(tz)
    candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def seconds_until_ss(
    tz: ZoneInfo, hour: int, minute: int, prewake_minutes: int
) -> float:
    target = next_ss_datetime(tz, hour, minute)
    remaining = (target - datetime.now(tz)).total_seconds()
    return max(0.0, remaining - prewake_minutes * 60)


def wait_until_ss(tz: ZoneInfo, hour: int, minute: int, prewake_minutes: int) -> None:
    while True:
        remaining = seconds_until_ss(tz, hour, minute, prewake_minutes)
        if remaining <= 0:
            now = datetime.now(tz)
            LOG.info(
                "Horário do SS atingido (%s).",
                now.strftime("%Y-%m-%d %H:%M:%S %Z"),
            )
            return

        hours, rem = divmod(int(remaining), 3600)
        minutes, seconds = divmod(rem, 60)
        next_ss = next_ss_datetime(tz, hour, minute)
        LOG.info(
            "Aguardando SS às %02d:%02d — faltam %02d:%02d:%02d (próximo: %s)",
            hour,
            minute,
            hours,
            minutes,
            seconds,
            next_ss.strftime("%d/%m %H:%M"),
        )
        time.sleep(min(remaining, 30))


def main() -> int:
    parser = argparse.ArgumentParser(description="Relogin automático Poketibia após SS")
    parser.add_argument(
        "--test",
        action="store_true",
        help="Executa o relogin agora, sem esperar o horário do SS",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    load_dotenv(SCRIPT_DIR / "config.env")
    load_dotenv(SCRIPT_DIR / "config.example.env")

    try:
        client = PoketibiaClient(load_config())
    except ValueError as error:
        LOG.error("%s", error)
        return 1

    tz = ZoneInfo(os.environ.get("TIMEZONE", "America/Sao_Paulo"))
    ss_hour = env_int("SS_HOUR", 0)
    ss_minute = env_int("SS_MINUTE", 0)
    prewake = env_int("PREWAKE_MINUTES", 0)

    LOG.info(
        "Poketibia SS auto-relogin | SS=%02d:%02d | janela=%s | modo=%s",
        ss_hour,
        ss_minute,
        os.environ.get("WINDOW_TITLE_CONTAINS", "OTClient"),
        os.environ.get("RELOGIN_MODE", "full"),
    )
    LOG.info("Mova o mouse para o canto superior esquerdo para abortar (pyautogui failsafe).")

    try:
        if args.test:
            LOG.info("Modo teste — relogin imediato.")
            client.perform_relogin()
            return 0

        while True:
            wait_until_ss(tz, ss_hour, ss_minute, prewake)
            client.relogin_after_ss()
            LOG.info("Ciclo do SS concluído. Aguardando o próximo...")
            time.sleep(60)
    except KeyboardInterrupt:
        LOG.info("Encerrado pelo usuário.")
        return 0
    except Exception:
        LOG.exception("Erro fatal.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
