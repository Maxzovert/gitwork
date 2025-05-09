'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/trpc/react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

type FormInput = {
    repoUrl: string
    projectName: string
    githubToken?: string
}

const CreatePage = () => {
    const { register, handleSubmit, reset } = useForm<FormInput>()
    const createProject = api.project.createProject.useMutation()

    function onSubmit(data : FormInput){
        window.alert(JSON.stringify(data, null , 2))
        createProject.mutate({
            githubUrl: data.repoUrl,
            name : data.projectName,
            githubToken : data.githubToken
        },{
            onSuccess : () => {
                toast.success('Project Created Successfully')
            },
            onError: () => {
                toast.error('Project Creation Failed')
            }
        })
        return true
    }
  return (
    <div className='flex items-center gap-12 h-full justify-center'> 
    <img src="/create-page-image.png" alt="" className='h-59 w-auto'/>
        <div>
            <div>
                <h1 className="font-semibold text-2xl">Link Your Github Repository</h1>
                <p className='text-sm text-muted-foreground'>
                    Enter the URL of your Repository to link it with GitWork
                </p>
            </div>
            <div className='h-4'></div>
                <div>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <Input {...register('projectName',{required:true})}
                        placeholder='Project Name'
                        required
                        />
                        <div className="h-2"></div>
                        <Input {...register('repoUrl',{required:true})}
                        placeholder='Github Repository URL'
                        type='url'
                        required
                        />
                        <div className="h-2"></div>
                        <Input {...register('githubToken')}
                        placeholder='Github Token (Optional)'
                        />
                        <div className="h-4"></div>
                            <Button type='submit'>Create Project</Button>
                    </form>
                </div>
        </div>
    </div>
  )
}

export default CreatePage
