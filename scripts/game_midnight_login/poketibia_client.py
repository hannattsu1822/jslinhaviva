"""
Automação de relogin no OTClient (Poketibia) após Server Save (SS).

Funciona focando a janela do cliente e simulando teclado.
Ajuste RELOGIN_MODE no config.env conforme o que aparece na tela após o SS.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import pyautogui
import pygetwindow as gw
import pyperclip

LOG = logging.getLogger("poketibia")
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.05


@dataclass
class PoketibiaConfig:
    account: str
    password: str
    character_index: int
    window_title_contains: str
    action_delay_sec: float
    relogin_mode: str
    ss_restart_wait_sec: int
    login_retries: int
    login_retry_interval_sec: int


class PoketibiaClient:
    def __init__(self, config: PoketibiaConfig) -> None:
        self.config = config

    def _pause(self, multiplier: float = 1.0) -> None:
        time.sleep(self.config.action_delay_sec * multiplier)

    def focus_client(self) -> None:
        needle = self.config.window_title_contains.lower()
        matches = [
            window
            for window in gw.getAllWindows()
            if needle in (window.title or "").lower() and window.title.strip()
        ]
        if not matches:
            raise RuntimeError(
                f'Janela com "{self.config.window_title_contains}" no título não encontrada. '
                "Abra o OTClient e ajuste WINDOW_TITLE_CONTAINS."
            )

        window = matches[0]
        if window.isMinimized:
            window.restore()
        window.activate()
        self._pause(2)

        # Clique no centro para garantir foco no cliente
        center_x = window.left + window.width // 2
        center_y = window.top + window.height // 2
        pyautogui.click(center_x, center_y)
        self._pause(1.5)

    def _dismiss_dialogs(self) -> None:
        pyautogui.press("escape")
        self._pause(0.5)

    def _paste_text(self, text: str) -> None:
        pyperclip.copy(text)
        pyautogui.hotkey("ctrl", "a")
        self._pause(0.2)
        pyautogui.hotkey("ctrl", "v")
        self._pause(0.3)

    def _type_account_and_password(self) -> None:
        self._paste_text(self.config.account)
        self._pause(0.5)
        pyautogui.press("tab")
        self._pause(0.3)
        self._paste_text(self.config.password)
        self._pause(0.5)

    def _connect_to_server(self) -> None:
        pyautogui.press("enter")
        self._pause(8)

    def _select_character(self) -> None:
        for _ in range(max(0, self.config.character_index)):
            pyautogui.press("down")
            self._pause(0.25)
        pyautogui.press("enter")
        self._pause(3)

    def perform_relogin(self) -> None:
        mode = self.config.relogin_mode.lower()
        LOG.info("Relogin modo=%s", mode)

        self.focus_client()
        self._dismiss_dialogs()

        if mode == "enter_only":
            pyautogui.press("enter")
            self._pause(2)
            pyautogui.press("enter")
            return

        if mode in ("full", "character_only"):
            if mode == "full":
                self._type_account_and_password()
                self._connect_to_server()
            else:
                pyautogui.press("enter")
                self._pause(6)

            self._select_character()
            return

        raise ValueError(
            f'RELOGIN_MODE inválido: "{self.config.relogin_mode}". '
            "Use: full, character_only ou enter_only."
        )

    def relogin_after_ss(self) -> None:
        LOG.info(
            "Aguardando %ss para o servidor voltar após o SS...",
            self.config.ss_restart_wait_sec,
        )
        time.sleep(self.config.ss_restart_wait_sec)

        for attempt in range(1, self.config.login_retries + 1):
            try:
                LOG.info("Tentativa de relogin %s/%s", attempt, self.config.login_retries)
                self.perform_relogin()
                LOG.info("Relogin enviado com sucesso.")
                return
            except Exception:
                LOG.exception("Falha na tentativa %s", attempt)
                if attempt < self.config.login_retries:
                    time.sleep(self.config.login_retry_interval_sec)

        raise RuntimeError("Esgotadas as tentativas de relogin após o SS.")
