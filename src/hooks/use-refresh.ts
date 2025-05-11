import { useQueryClient } from '@tanstack/react-query'

const useRefresh = () => {
    const querryCLient = useQueryClient();
    return async () => {
        await querryCLient.refetchQueries({
            type: 'active'
    })
    }
}

export default useRefresh
