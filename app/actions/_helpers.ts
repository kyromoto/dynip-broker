export function destructerFetchResponse(res: Response) {
    return {
        url: res.url,
        status: res.status,
        message: res.statusText,
        body: res.headers.get("Content-Type")?.toLowerCase() === "application/json" ? res.json() : res.text()
    }
}