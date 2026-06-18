"""Provider interface: a source of listings (Immoweb, etc.)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List

from ..criteria import Criteria
from ..models import Listing


class Provider(ABC):
    name: str = "base"

    @abstractmethod
    def search(self, criteria: Criteria) -> List[Listing]:
        """Return listings from this source that roughly match `criteria`.

        Providers should push as much filtering server-side as the source
        allows; the caller applies the precise criteria afterwards.
        """
        raise NotImplementedError
